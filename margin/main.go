// Margin — a Kindle-inspired reader for Markdown (especially LLM-generated Markdown).
//
// It is a single self-contained program: a tiny local web server that embeds the
// whole reader UI and serves your .md files to a browser tab. Pure Go standard
// library, no cgo, so it builds the same way on Windows, Linux and macOS.
package main

import (
	"bufio"
	"bytes"
	"crypto/sha1"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const version = "1.3.0"

//go:embed all:web
var webFS embed.FS

//go:embed samples
var samplesFS embed.FS

// ---------------------------------------------------------------------------
// Types

type Root struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Path      string `json:"path"`
	Kind      string `json:"kind"` // builtin | imported | cli | saved
	Removable bool   `json:"removable"`
	Missing   bool   `json:"missing,omitempty"`
}

type Book struct {
	ID     string `json:"id"`
	Root   string `json:"root"`
	Rel    string `json:"rel"`
	Folder string `json:"folder"`
	Title  string `json:"title"`
	Size   int64  `json:"size"`
	MTime  int64  `json:"mtime"`
	Words  int    `json:"words"`
}

type config struct {
	Roots []string `json:"roots"`
}

type meta struct {
	size  int64
	mtime int64
	title string
	words int
	heads []Heading
}

// Heading is one entry of a document outline (levels 1–3).
type Heading struct {
	Level int    `json:"level"`
	Text  string `json:"text"`
}

// Sibling is another Markdown file in the same folder — a chapter of the same "book".
type Sibling struct {
	ID       string    `json:"id"`
	Title    string    `json:"title"`
	Rel      string    `json:"rel"`
	Chapter  int       `json:"chapter"`
	Headings []Heading `json:"headings"`
}

type App struct {
	dataDir  string
	cliRoots []string

	mu    sync.RWMutex
	cfg   config
	cache map[string]meta

	writeMu sync.Mutex
}

// ---------------------------------------------------------------------------
// main

func main() {
	var (
		host    = flag.String("host", "127.0.0.1", "address to listen on (use 0.0.0.0 to read from a tablet/phone on your LAN)")
		port    = flag.Int("port", 7878, "port to listen on (the next free port is used if busy)")
		noOpen  = flag.Bool("no-open", false, "do not open the browser automatically")
		dataDir = flag.String("data", "", "where highlights, progress and settings are stored (default: user config dir)/margin")
		showVer = flag.Bool("version", false, "print version and exit")
	)
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Margin %s — Kindle-style reader for Markdown\n\nUsage:\n  margin [flags] [folder-or-file ...]\n\nWith no folder, the current directory is used.\n\nFlags:\n", version)
		flag.PrintDefaults()
	}
	flag.Parse()
	if *showVer {
		fmt.Println("margin", version)
		return
	}

	app := &App{cache: map[string]meta{}}
	if *dataDir == "" {
		base, err := os.UserConfigDir()
		if err != nil {
			base, _ = os.UserHomeDir()
		}
		*dataDir = filepath.Join(base, "margin")
	}
	app.dataDir = *dataDir
	for _, d := range []string{app.dataDir, app.stateDir(), app.importDir()} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			log.Fatalf("cannot create data dir %s: %v", d, err)
		}
	}
	app.loadConfig()

	args := flag.Args()
	if len(args) == 0 {
		if wd, err := os.Getwd(); err == nil {
			args = []string{wd}
		}
	}
	var openFile string
	for _, a := range args {
		abs, err := filepath.Abs(a)
		if err != nil {
			continue
		}
		st, err := os.Stat(abs)
		if err != nil {
			log.Printf("skipping %s: %v", a, err)
			continue
		}
		if st.IsDir() {
			app.cliRoots = append(app.cliRoots, abs)
		} else if isMarkdown(abs) {
			// A single file: serve its folder, and open the file directly.
			app.cliRoots = append(app.cliRoots, filepath.Dir(abs))
			if openFile == "" {
				openFile = fmt.Sprintf("c%d:%s", len(app.cliRoots)-1, filepath.Base(abs))
			}
		}
	}

	mux := http.NewServeMux()
	app.routes(mux)

	ln, actualPort, err := listen(*host, *port)
	if err != nil {
		log.Fatal(err)
	}
	displayHost := *host
	if displayHost == "0.0.0.0" || displayHost == "" || displayHost == "::" {
		displayHost = "localhost"
	}
	url := fmt.Sprintf("http://%s:%d/", displayHost, actualPort)
	if openFile != "" {
		url += "#/read/" + urlEncode(openFile)
	}

	fmt.Printf("\n  Margin %s is running\n\n  Open:     %s\n  Library:  %s\n  Data:     %s\n\n  Press Ctrl+C (or close this window) to stop.\n\n",
		version, url, strings.Join(app.cliRoots, ", "), app.dataDir)
	if *host == "0.0.0.0" {
		for _, ip := range lanIPs() {
			fmt.Printf("  On your LAN: http://%s:%d/\n", ip, actualPort)
		}
		fmt.Println()
	}
	if !*noOpen {
		go func() { time.Sleep(300 * time.Millisecond); openBrowser(url) }()
	}
	srv := &http.Server{Handler: logRequests(mux), ReadHeaderTimeout: 10 * time.Second}
	log.Fatal(srv.Serve(ln))
}

func listen(host string, port int) (net.Listener, int, error) {
	var lastErr error
	for p := port; p < port+30; p++ {
		ln, err := net.Listen("tcp", net.JoinHostPort(host, strconv.Itoa(p)))
		if err == nil {
			return ln, p, nil
		}
		lastErr = err
	}
	return nil, 0, fmt.Errorf("no free port near %d: %v", port, lastErr)
}

func lanIPs() []string {
	var out []string
	addrs, _ := net.InterfaceAddrs()
	for _, a := range addrs {
		if ipn, ok := a.(*net.IPNet); ok && !ipn.IP.IsLoopback() && ipn.IP.To4() != nil {
			out = append(out, ipn.IP.String())
		}
	}
	return out
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		fmt.Println("  (Could not open a browser automatically — open the URL above yourself.)")
	}
}

func logRequests(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		h.ServeHTTP(w, r)
	})
}

// ---------------------------------------------------------------------------
// Paths & config

func (a *App) stateDir() string  { return filepath.Join(a.dataDir, "state") }
func (a *App) importDir() string { return filepath.Join(a.dataDir, "imported") }

func (a *App) loadConfig() {
	b, err := os.ReadFile(filepath.Join(a.dataDir, "config.json"))
	if err == nil {
		_ = json.Unmarshal(b, &a.cfg)
	}
}

func (a *App) saveConfig() error {
	b, _ := json.MarshalIndent(a.cfg, "", "  ")
	return writeFileAtomic(filepath.Join(a.dataDir, "config.json"), b)
}

func writeFileAtomic(p string, b []byte) error {
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

func shortHash(s string) string {
	h := sha1.Sum([]byte(s))
	return hex.EncodeToString(h[:])[:10]
}

func (a *App) roots() []Root {
	a.mu.RLock()
	defer a.mu.RUnlock()
	rs := []Root{{ID: "b", Name: "Getting started", Path: "(built in)", Kind: "builtin"}}
	for i, p := range a.cliRoots {
		rs = append(rs, Root{ID: fmt.Sprintf("c%d", i), Name: filepath.Base(p), Path: p, Kind: "cli"})
	}
	for _, p := range a.cfg.Roots {
		r := Root{ID: "s" + shortHash(p), Name: filepath.Base(p), Path: p, Kind: "saved", Removable: true}
		if st, err := os.Stat(p); err != nil || !st.IsDir() {
			r.Missing = true
		}
		rs = append(rs, r)
	}
	rs = append(rs, Root{ID: "i", Name: "Imported", Path: a.importDir(), Kind: "imported"})
	return rs
}

func (a *App) rootByID(id string) (Root, bool) {
	for _, r := range a.roots() {
		if r.ID == id {
			return r, true
		}
	}
	return Root{}, false
}

var errBadPath = errors.New("invalid path")

// resolve turns "rootID:rel/path.md" into a root and a cleaned relative path,
// refusing anything that would escape the root.
func (a *App) resolve(id string) (Root, string, error) {
	i := strings.IndexByte(id, ':')
	if i < 1 {
		return Root{}, "", errBadPath
	}
	r, ok := a.rootByID(id[:i])
	if !ok {
		return Root{}, "", errBadPath
	}
	rel, err := cleanRel(id[i+1:])
	if err != nil {
		return Root{}, "", err
	}
	return r, rel, nil
}

func cleanRel(rel string) (string, error) {
	rel = strings.ReplaceAll(rel, "\\", "/")
	if rel == "" || strings.HasPrefix(rel, "/") || strings.Contains(rel, "\x00") || filepath.IsAbs(rel) {
		return "", errBadPath
	}
	c := path.Clean(rel)
	if c == "." || c == ".." || strings.HasPrefix(c, "../") || (len(c) > 1 && c[1] == ':') {
		return "", errBadPath
	}
	return c, nil
}

func (a *App) absPath(r Root, rel string) string {
	return filepath.Join(r.Path, filepath.FromSlash(rel))
}

func (a *App) readFile(r Root, rel string) ([]byte, int64, error) {
	if r.Kind == "builtin" {
		b, err := samplesFS.ReadFile("samples/" + rel)
		return b, 0, err
	}
	p := a.absPath(r, rel)
	st, err := os.Stat(p)
	if err != nil {
		return nil, 0, err
	}
	if st.IsDir() {
		return nil, 0, errBadPath
	}
	b, err := os.ReadFile(p)
	return b, st.ModTime().UnixMilli(), err
}

func (a *App) stateKey(r Root, rel string) string {
	if r.Kind == "builtin" {
		return "builtin-" + shortHash(rel)
	}
	p := filepath.Clean(a.absPath(r, rel))
	if runtime.GOOS == "windows" {
		p = strings.ToLower(p)
	}
	return shortHash(p) + shortHash("v1"+p)
}

// ---------------------------------------------------------------------------
// Library scanning

var mdExt = map[string]bool{".md": true, ".markdown": true, ".mdown": true, ".mkd": true, ".mdx": true}

func isMarkdown(p string) bool { return mdExt[strings.ToLower(filepath.Ext(p))] }

var skipDirs = map[string]bool{"node_modules": true, "__pycache__": true, "venv": true, ".venv": true, "vendor": true, "dist": true, "build": true, "target": true}

const maxBooks = 5000

func (a *App) scan() []Book {
	var books []Book
	for _, r := range a.roots() {
		if r.Missing {
			continue
		}
		if r.Kind == "builtin" {
			_ = fs.WalkDir(samplesFS, "samples", func(p string, d fs.DirEntry, err error) error {
				if err != nil || d.IsDir() || !isMarkdown(p) {
					return nil
				}
				b, _ := samplesFS.ReadFile(p)
				rel := strings.TrimPrefix(p, "samples/")
				title, words := analyze(b, rel)
				books = append(books, Book{ID: "b:" + rel, Root: "b", Rel: rel, Title: title, Size: int64(len(b)), Words: words})
				return nil
			})
			continue
		}
		base := r.Path
		_ = filepath.WalkDir(base, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				if d != nil && d.IsDir() {
					return fs.SkipDir
				}
				return nil
			}
			name := d.Name()
			if d.IsDir() {
				if p != base && (strings.HasPrefix(name, ".") || skipDirs[name]) {
					return fs.SkipDir
				}
				if rel, _ := filepath.Rel(base, p); strings.Count(rel, string(filepath.Separator)) >= 8 {
					return fs.SkipDir
				}
				return nil
			}
			if !isMarkdown(name) || strings.HasPrefix(name, ".") {
				return nil
			}
			if len(books) >= maxBooks {
				return fs.SkipAll
			}
			info, err := d.Info()
			if err != nil {
				return nil
			}
			rel, _ := filepath.Rel(base, p)
			rel = filepath.ToSlash(rel)
			m := a.meta(p, rel, info)
			folder := path.Dir(rel)
			if folder == "." {
				folder = ""
			}
			books = append(books, Book{ID: r.ID + ":" + rel, Root: r.ID, Rel: rel, Folder: folder, Title: m.title, Size: m.size, MTime: m.mtime, Words: m.words})
			return nil
		})
	}
	return books
}

func (a *App) meta(p, rel string, info fs.FileInfo) meta {
	mt := info.ModTime().UnixMilli()
	a.mu.RLock()
	m, ok := a.cache[p]
	a.mu.RUnlock()
	if ok && m.mtime == mt && m.size == info.Size() {
		return m
	}
	m = meta{size: info.Size(), mtime: mt}
	if info.Size() < 20<<20 {
		if b, err := os.ReadFile(p); err == nil {
			m.title, m.words = analyze(b, rel)
			m.heads = outline(b)
		}
	}
	if m.title == "" {
		m.title = prettyName(rel)
	}
	a.mu.Lock()
	a.cache[p] = m
	a.mu.Unlock()
	return m
}

var (
	reHeading   = regexp.MustCompile(`^\s{0,3}#{1,2}\s+(.+?)\s*#*\s*$`)
	reFMTitle   = regexp.MustCompile(`^title:\s*["']?(.+?)["']?\s*$`)
	reMdSyntax  = regexp.MustCompile("[*_`~\\[\\]]|\\(https?://[^)]*\\)")
	reWordSplit = regexp.MustCompile(`\s+`)
)

// analyze finds a display title and a rough word count.
func analyze(b []byte, rel string) (string, int) {
	if !utf8.Valid(b) {
		b = bytes.ToValidUTF8(b, []byte("?"))
	}
	title := ""
	sc := bufio.NewScanner(bytes.NewReader(b))
	sc.Buffer(make([]byte, 64*1024), 1024*1024)
	line, inFM, inFence := 0, false, false
	for sc.Scan() && line < 200 {
		t := sc.Text()
		line++
		if line == 1 && strings.TrimSpace(t) == "---" {
			inFM = true
			continue
		}
		if inFM {
			if strings.TrimSpace(t) == "---" {
				inFM = false
			} else if m := reFMTitle.FindStringSubmatch(t); m != nil && title == "" {
				title = m[1]
			}
			continue
		}
		trim := strings.TrimSpace(t)
		if strings.HasPrefix(trim, "```") || strings.HasPrefix(trim, "~~~") {
			lang := strings.ToLower(strings.Trim(trim, "`~ "))
			// An LLM answer wrapped entirely in ```markdown is still prose.
			if !(line <= 3 && (lang == "markdown" || lang == "md")) {
				inFence = !inFence
			}
			continue
		}
		if inFence || title != "" {
			continue
		}
		if m := reHeading.FindStringSubmatch(t); m != nil {
			title = strings.TrimSpace(reMdSyntax.ReplaceAllString(m[1], ""))
		}
	}
	if title == "" {
		title = prettyName(rel)
	}
	if len(title) > 160 {
		title = title[:160] + "…"
	}
	words := len(reWordSplit.Split(strings.TrimSpace(string(b)), -1))
	return title, words
}

var (
	reOutline   = regexp.MustCompile(`^\s{0,3}(#{1,3})\s+(.+?)\s*#*\s*$`)
	reMdLink    = regexp.MustCompile(`\[([^\]]*)\]\([^)]*\)`)
	reMdMarks   = regexp.MustCompile("\\*\\*|__|`|\\$")
	reFileNum   = regexp.MustCompile(`^(\d{1,3})(?:[-_. ]|$)`)
	reTitleChap = regexp.MustCompile(`(?i)^(?:chapter|ch\.?|unit|lesson|part|module)\s+(\d{1,3})\b`)
	reTitleNum  = regexp.MustCompile(`^(\d{1,3})\s*[.:·\-–—]\s*\D`)
	reSecNum    = regexp.MustCompile(`^(\d{1,3})\.\d`)
)

// outline lists the headings (levels 1–3) of a Markdown document.
func outline(b []byte) []Heading {
	if !utf8.Valid(b) {
		b = bytes.ToValidUTF8(b, []byte("?"))
	}
	var out []Heading
	sc := bufio.NewScanner(bytes.NewReader(b))
	sc.Buffer(make([]byte, 64*1024), 1024*1024)
	line, inFM, inFence := 0, false, false
	for sc.Scan() {
		t := sc.Text()
		line++
		if line == 1 && strings.TrimSpace(t) == "---" {
			inFM = true
			continue
		}
		if inFM {
			if strings.TrimSpace(t) == "---" {
				inFM = false
			}
			continue
		}
		trim := strings.TrimSpace(t)
		if strings.HasPrefix(trim, "```") || strings.HasPrefix(trim, "~~~") {
			lang := strings.ToLower(strings.Trim(trim, "`~ "))
			if !(line <= 3 && (lang == "markdown" || lang == "md")) {
				inFence = !inFence
			}
			continue
		}
		if inFence {
			continue
		}
		if m := reOutline.FindStringSubmatch(t); m != nil {
			text := reMdLink.ReplaceAllString(m[2], "$1")
			text = strings.TrimSpace(reMdMarks.ReplaceAllString(text, ""))
			if text != "" {
				out = append(out, Heading{Level: len(m[1]), Text: text})
			}
			if len(out) >= 400 {
				break
			}
		}
	}
	return out
}

// chapterNumber guesses a file's chapter number: "03-…md", "Chapter 3 · …", "3. …", or sections "3.1 …".
func chapterNumber(rel, title string, heads []Heading) int {
	atoi := func(s string) int { n, _ := strconv.Atoi(s); return n }
	if m := reFileNum.FindStringSubmatch(path.Base(rel)); m != nil {
		return atoi(m[1])
	}
	if m := reTitleChap.FindStringSubmatch(title); m != nil {
		return atoi(m[1])
	}
	if m := reTitleNum.FindStringSubmatch(title); m != nil {
		return atoi(m[1])
	}
	counts := map[int]int{}
	for _, h := range heads {
		if h.Level >= 2 {
			if m := reSecNum.FindStringSubmatch(h.Text); m != nil {
				counts[atoi(m[1])]++
			}
		}
	}
	best, n := 0, 0
	for k, v := range counts {
		if v > n {
			best, n = k, v
		}
	}
	if n >= 2 {
		return best
	}
	return 0
}

// naturalLess sorts "2-x.md" before "10-x.md".
func naturalLess(a, b string) bool {
	a, b = strings.ToLower(a), strings.ToLower(b)
	for a != "" && b != "" {
		ca, cb := a[0], b[0]
		if ca >= '0' && ca <= '9' && cb >= '0' && cb <= '9' {
			i, j := 0, 0
			for i < len(a) && a[i] >= '0' && a[i] <= '9' {
				i++
			}
			for j < len(b) && b[j] >= '0' && b[j] <= '9' {
				j++
			}
			na, _ := strconv.Atoi(a[:i])
			nb, _ := strconv.Atoi(b[:j])
			if na != nb {
				return na < nb
			}
			a, b = a[i:], b[j:]
			continue
		}
		if ca != cb {
			return ca < cb
		}
		a, b = a[1:], b[1:]
	}
	return len(a) < len(b)
}

func prettyName(rel string) string {
	n := path.Base(rel)
	n = strings.TrimSuffix(n, path.Ext(n))
	n = strings.NewReplacer("_", " ", "-", " ").Replace(n)
	return strings.TrimSpace(n)
}

// ---------------------------------------------------------------------------
// HTTP

func (a *App) routes(mux *http.ServeMux) {
	sub, _ := fs.Sub(webFS, "web")
	static := http.FileServer(http.FS(sub))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/vendor/") {
			w.Header().Set("Cache-Control", "public, max-age=604800")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		static.ServeHTTP(w, r)
	})
	mux.HandleFunc("/api/info", a.hInfo)
	mux.HandleFunc("/api/library", a.hLibrary)
	mux.HandleFunc("/api/book", a.hBook)
	mux.HandleFunc("/api/siblings", a.hSiblings)
	mux.HandleFunc("/api/asset", a.hAsset)
	mux.HandleFunc("/api/state", a.hState)
	mux.HandleFunc("/api/states", a.hStates)
	mux.HandleFunc("/api/settings", a.hSettings)
	mux.HandleFunc("/api/roots", a.hRoots)
	mux.HandleFunc("/api/import", a.hImport)
	mux.HandleFunc("/api/events", a.hEvents)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(v)
}

func httpErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// sameOrigin blocks other websites from writing to the local server (CSRF / DNS tricks).
func sameOrigin(r *http.Request) bool {
	o := r.Header.Get("Origin")
	if o == "" {
		return true
	}
	o = strings.TrimPrefix(strings.TrimPrefix(o, "http://"), "https://")
	return o == r.Host
}

func (a *App) hInfo(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{"version": version, "dataDir": a.dataDir, "os": runtime.GOOS, "roots": a.roots()})
}

func (a *App) hLibrary(w http.ResponseWriter, r *http.Request) {
	books := a.scan()
	sort.Slice(books, func(i, j int) bool { return books[i].ID < books[j].ID })
	writeJSON(w, map[string]any{"roots": a.roots(), "books": books, "truncated": len(books) >= maxBooks})
}

func (a *App) hBook(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	root, rel, err := a.resolve(id)
	if err == nil && !isMarkdown(rel) {
		err = errors.New("only Markdown files can be opened")
	}
	if err != nil {
		httpErr(w, 400, err.Error())
		return
	}
	switch r.Method {
	case http.MethodGet:
		b, mt, err := a.readFile(root, rel)
		if err != nil {
			httpErr(w, 404, "file not found")
			return
		}
		if !utf8.Valid(b) {
			b = bytes.ToValidUTF8(b, []byte("�"))
		}
		b = bytes.TrimPrefix(b, []byte("\xef\xbb\xbf"))
		title, words := analyze(b, rel)
		writeJSON(w, map[string]any{"id": id, "root": root.ID, "rootName": root.Name, "rel": rel, "title": title, "words": words, "mtime": mt, "markdown": string(b), "deletable": root.Kind == "imported"})
	case http.MethodDelete:
		if !sameOrigin(r) || root.Kind != "imported" {
			httpErr(w, 403, "only imported files can be removed")
			return
		}
		if err := os.Remove(a.absPath(root, rel)); err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		_ = os.Remove(filepath.Join(a.stateDir(), a.stateKey(root, rel)+".json"))
		writeJSON(w, map[string]bool{"ok": true})
	default:
		httpErr(w, 405, "method not allowed")
	}
}

// hSiblings lists the Markdown files in the same folder as a document, in
// natural order, with their chapter numbers and outlines: the chapters of a book.
func (a *App) hSiblings(w http.ResponseWriter, r *http.Request) {
	root, rel, err := a.resolve(r.URL.Query().Get("id"))
	if err != nil {
		httpErr(w, 400, err.Error())
		return
	}
	folder := path.Dir(rel)
	var list []Sibling
	for _, b := range a.scan() {
		if b.Root != root.ID || path.Dir(b.Rel) != folder {
			continue
		}
		var heads []Heading
		if root.Kind == "builtin" {
			if data, _, err := a.readFile(root, b.Rel); err == nil {
				heads = outline(data)
			}
		} else {
			p := a.absPath(root, b.Rel)
			a.mu.RLock()
			heads = a.cache[p].heads
			a.mu.RUnlock()
		}
		list = append(list, Sibling{ID: b.ID, Title: b.Title, Rel: b.Rel, Chapter: chapterNumber(b.Rel, b.Title, heads), Headings: heads})
		if len(list) >= 300 {
			break
		}
	}
	sort.Slice(list, func(i, j int) bool { return naturalLess(list[i].Rel, list[j].Rel) })
	name := path.Base(folder)
	if folder == "." {
		name = root.Name
	}
	writeJSON(w, map[string]any{"folder": name, "books": list})
}

var imageExt = map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".svg": true, ".webp": true, ".avif": true, ".bmp": true, ".ico": true}

// hAsset serves images referenced relatively from a Markdown file (e.g. ![](img/plot.png)).
func (a *App) hAsset(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	root, rel, err := a.resolve(q.Get("id"))
	if err != nil {
		httpErr(w, 400, err.Error())
		return
	}
	src := q.Get("src")
	if i := strings.IndexAny(src, "?#"); i >= 0 {
		src = src[:i]
	}
	target, err := cleanRel(path.Join(path.Dir(rel), src))
	if err != nil || !imageExt[strings.ToLower(path.Ext(target))] {
		httpErr(w, 400, "not an image inside the library")
		return
	}
	b, _, err := a.readFile(root, target)
	if err != nil {
		httpErr(w, 404, "image not found")
		return
	}
	ct := mime.TypeByExtension(path.Ext(target))
	if ct == "" {
		ct = http.DetectContentType(b)
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
	w.Header().Set("Cache-Control", "max-age=60")
	_, _ = w.Write(b)
}

func (a *App) hState(w http.ResponseWriter, r *http.Request) {
	root, rel, err := a.resolve(r.URL.Query().Get("id"))
	if err != nil {
		httpErr(w, 400, err.Error())
		return
	}
	p := filepath.Join(a.stateDir(), a.stateKey(root, rel)+".json")
	switch r.Method {
	case http.MethodGet:
		b, err := os.ReadFile(p)
		if err != nil {
			writeJSON(w, map[string]any{})
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(b)
	case http.MethodPut, http.MethodPost:
		if !sameOrigin(r) {
			httpErr(w, 403, "cross-origin write refused")
			return
		}
		b, err := io.ReadAll(io.LimitReader(r.Body, 16<<20))
		if err != nil || !json.Valid(b) {
			httpErr(w, 400, "invalid JSON")
			return
		}
		a.writeMu.Lock()
		err = writeFileAtomic(p, b)
		a.writeMu.Unlock()
		if err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	default:
		httpErr(w, 405, "method not allowed")
	}
}

// hStates returns every saved book state in the current library (progress, cards…).
func (a *App) hStates(w http.ResponseWriter, r *http.Request) {
	out := map[string]json.RawMessage{}
	for _, b := range a.scan() {
		root, rel, err := a.resolve(b.ID)
		if err != nil {
			continue
		}
		data, err := os.ReadFile(filepath.Join(a.stateDir(), a.stateKey(root, rel)+".json"))
		if err == nil && json.Valid(data) {
			out[b.ID] = data
		}
	}
	writeJSON(w, out)
}

func (a *App) hSettings(w http.ResponseWriter, r *http.Request) {
	p := filepath.Join(a.dataDir, "settings.json")
	switch r.Method {
	case http.MethodGet:
		b, err := os.ReadFile(p)
		if err != nil || !json.Valid(b) {
			writeJSON(w, map[string]any{})
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(b)
	case http.MethodPut, http.MethodPost:
		if !sameOrigin(r) {
			httpErr(w, 403, "cross-origin write refused")
			return
		}
		b, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil || !json.Valid(b) {
			httpErr(w, 400, "invalid JSON")
			return
		}
		a.writeMu.Lock()
		err = writeFileAtomic(p, b)
		a.writeMu.Unlock()
		if err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	default:
		httpErr(w, 405, "method not allowed")
	}
}

// hRoots lets the UI add/remove library folders by path (handy when Margin is
// started by double-clicking, with no command-line arguments).
func (a *App) hRoots(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, a.roots())
		return
	case http.MethodPost:
		if !sameOrigin(r) {
			httpErr(w, 403, "cross-origin write refused")
			return
		}
		var body struct {
			Path string `json:"path"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 8192)).Decode(&body); err != nil {
			httpErr(w, 400, "invalid JSON")
			return
		}
		p := strings.Trim(strings.TrimSpace(body.Path), `"'`)
		if strings.HasPrefix(p, "~") {
			if h, err := os.UserHomeDir(); err == nil {
				p = filepath.Join(h, p[1:])
			}
		}
		abs, err := filepath.Abs(p)
		if err != nil {
			httpErr(w, 400, "invalid path")
			return
		}
		st, err := os.Stat(abs)
		if err != nil || !st.IsDir() {
			httpErr(w, 400, "folder not found: "+abs)
			return
		}
		a.mu.Lock()
		dup := false
		for _, x := range append(append([]string{}, a.cfg.Roots...), a.cliRoots...) {
			if x == abs {
				dup = true
			}
		}
		if !dup {
			a.cfg.Roots = append(a.cfg.Roots, abs)
		}
		err = a.saveConfig()
		a.mu.Unlock()
		if err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		writeJSON(w, a.roots())
	case http.MethodDelete:
		if !sameOrigin(r) {
			httpErr(w, 403, "cross-origin write refused")
			return
		}
		id := r.URL.Query().Get("id")
		a.mu.Lock()
		kept := a.cfg.Roots[:0]
		for _, p := range a.cfg.Roots {
			if "s"+shortHash(p) != id {
				kept = append(kept, p)
			}
		}
		a.cfg.Roots = kept
		err := a.saveConfig()
		a.mu.Unlock()
		if err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		writeJSON(w, a.roots())
	default:
		httpErr(w, 405, "method not allowed")
	}
}

var reUnsafeName = regexp.MustCompile(`[^\p{L}\p{N} ._()\-]+`)

// hImport stores a file dropped into the browser in the "Imported" shelf.
func (a *App) hImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !sameOrigin(r) {
		httpErr(w, 405, "POST only")
		return
	}
	name := filepath.Base(strings.ReplaceAll(r.URL.Query().Get("name"), "\\", "/"))
	name = strings.TrimSpace(reUnsafeName.ReplaceAllString(name, "_"))
	if name == "" || name == "." || strings.HasPrefix(name, ".") {
		name = "document.md"
	}
	if !isMarkdown(name) {
		name += ".md"
	}
	b, err := io.ReadAll(io.LimitReader(r.Body, 32<<20))
	if err != nil {
		httpErr(w, 400, "read failed")
		return
	}
	dst := filepath.Join(a.importDir(), name)
	ext := filepath.Ext(name)
	stem := strings.TrimSuffix(name, ext)
	for i := 2; ; i++ {
		existing, err := os.ReadFile(dst)
		if err != nil {
			break
		}
		if bytes.Equal(existing, b) { // same file dropped twice: reuse it
			writeJSON(w, map[string]string{"id": "i:" + filepath.Base(dst)})
			return
		}
		dst = filepath.Join(a.importDir(), fmt.Sprintf("%s (%d)%s", stem, i, ext))
	}
	if err := os.WriteFile(dst, b, 0o644); err != nil {
		httpErr(w, 500, err.Error())
		return
	}
	writeJSON(w, map[string]string{"id": "i:" + filepath.Base(dst)})
}

// hEvents is a Server-Sent Events stream: it tells the open tab when the book on
// screen changes on disk (e.g. an LLM rewrote it) or the library changes.
func (a *App) hEvents(w http.ResponseWriter, r *http.Request) {
	fl, ok := w.(http.Flusher)
	if !ok {
		httpErr(w, 500, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Connection", "keep-alive")
	fmt.Fprint(w, "retry: 3000\n\n")
	fl.Flush()

	var bookPath string
	if root, rel, err := a.resolve(r.URL.Query().Get("id")); err == nil && root.Kind != "builtin" {
		bookPath = a.absPath(root, rel)
	}
	stamp := func() int64 {
		if bookPath == "" {
			return 0
		}
		if st, err := os.Stat(bookPath); err == nil {
			return st.ModTime().UnixNano() ^ st.Size()
		}
		return -1
	}
	libSig := func() string {
		h := sha1.New()
		for _, b := range a.scan() {
			fmt.Fprintf(h, "%s|%d|%d\n", b.ID, b.MTime, b.Size)
		}
		return hex.EncodeToString(h.Sum(nil))
	}
	last := stamp()
	lastLib := ""
	if r.URL.Query().Get("library") == "1" {
		lastLib = libSig()
	}
	tick := time.NewTicker(1200 * time.Millisecond)
	defer tick.Stop()
	n := 0
	for {
		select {
		case <-r.Context().Done():
			return
		case <-tick.C:
			n++
			if s := stamp(); s != last {
				last = s
				// wait for the writer to finish (editors/LLM tools write in chunks)
				time.Sleep(250 * time.Millisecond)
				last = stamp()
				fmt.Fprint(w, "event: book\ndata: changed\n\n")
				fl.Flush()
			}
			if lastLib != "" && n%5 == 0 {
				if s := libSig(); s != lastLib {
					lastLib = s
					fmt.Fprint(w, "event: library\ndata: changed\n\n")
					fl.Flush()
				}
			}
			if n%12 == 0 {
				fmt.Fprint(w, ": ping\n\n")
				fl.Flush()
			}
		}
	}
}

func urlEncode(s string) string {
	var b strings.Builder
	for _, c := range []byte(s) {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || strings.IndexByte("-_.~", c) >= 0 {
			b.WriteByte(c)
		} else {
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}
