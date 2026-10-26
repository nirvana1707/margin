# Motion in a Straight Line

This sample chapter shows Margin's textbook format: worked examples with solutions you can reveal, quick checks and food-for-thought questions inside the text, and practice problems with an answer key at the end. By the end you will be able to describe motion along a line and solve problems with the equations of uniformly accelerated motion.

## 3.1 Position, Distance and Displacement

To describe motion along a straight line we first pick an *origin* and a positive direction. The position of a body is then a single number $x$, measured from the origin, positive on one side and negative on the other.

As a body moves, two different quantities tell us "how far" it has gone:

- **Distance**: the total length of the path actually travelled; it is always positive and never decreases.
- **Displacement**: the change in position, $\Delta x = x_2 - x_1$, which has both a size and a direction and can be positive, negative or zero.

If you walk 5 m forward and then 3 m back, you have covered a distance of 8 m but your displacement is only 2 m forward. Distance cares about the whole journey; displacement cares only about where you started and where you ended up.

> [!IMPORTANT]
> Displacement depends only on the initial and final positions — not on the path taken between them.

> [!QUESTION] Quick check 3.1
> A runner completes exactly one lap of a 400 m circular track. What distance has she covered, and what is her displacement?
>
> **Hint:** Where does she finish compared with where she started?
>
> **Answer:** She covers a distance of 400 m, but her displacement is zero because she ends at her starting point.

## 3.2 Speed and Velocity

Speed and velocity both describe how quickly position changes, but they are built from different quantities.

- **Average speed**: total distance travelled divided by the total time taken.
- **Average velocity**: displacement divided by the time taken, $\bar v = \dfrac{\Delta x}{\Delta t}$; it carries a direction.
- **Instantaneous velocity**: the velocity at a single moment, found as the limit $v = \dfrac{dx}{dt}$ as the time interval shrinks to zero.

Average speed is never smaller than the magnitude of average velocity, because the distance travelled is never smaller than the size of the displacement. The two are equal only when the body moves in one direction without turning back.

> [!EXAMPLE] Example 3.1 — A trip with a turn
> A car travels 60 km east in 1 hour, then 20 km west in 0.5 hour. Find its average speed and average velocity for the whole trip.
>
> **Solution:** Total distance $= 60 + 20 = 80$ km and total time $= 1.5$ h, so the average speed is $80 / 1.5 \approx 53.3$ km/h.
>
> The displacement is $60 - 20 = 40$ km east, so the average velocity is $40 / 1.5 \approx 26.7$ km/h towards the east.

> [!THINK] Food for thought
> Can a body have zero velocity at some instant and still be accelerating at that instant? Try to think of an everyday example before reading on.
>
> **Discussion:** Yes. A ball thrown straight up is momentarily at rest at the top of its flight, yet gravity is still changing its velocity at $9.8\ \text{m/s}^2$ downward. Zero velocity does not mean zero acceleration.

## 3.3 Acceleration

When velocity changes, the body accelerates.

- **Acceleration**: the rate of change of velocity, $a = \dfrac{dv}{dt}$; in SI units it is measured in metres per second squared ($\text{m/s}^2$).

Acceleration has a direction. If the acceleration points opposite to the velocity, the body slows down; this is often called *deceleration* or *retardation*. A negative sign on its own does not mean slowing down — it only means "pointing in the negative direction". A car moving in the negative direction with negative acceleration is actually speeding up.

On a velocity–time graph, the slope at any point gives the acceleration, and the area under the graph between two times gives the displacement in that interval. These two graphical facts are often the quickest way to solve a problem, and they lead directly to the equations of Section 3.4.

> [!QUESTION] Quick check 3.2
> A cyclist's velocity increases steadily from 5 m/s to 20 m/s in 3 s. What is her acceleration?
>
> **Answer:** $a = \dfrac{20 - 5}{3} = 5\ \text{m/s}^2$ in the direction of motion.

## 3.4 Equations of Uniformly Accelerated Motion

When the acceleration stays constant, the motion has a special name:

- **Uniformly accelerated motion**: motion in which the velocity changes by equal amounts in equal intervals of time.

Writing $u$ for the initial velocity, $v$ for the velocity after time $t$, $a$ for the acceleration and $s$ for the displacement, three equations follow:

$$
v = u + at
$$

$$
s = ut + \tfrac{1}{2}at^2
$$

$$
v^2 = u^2 + 2as
$$

Each equation leaves out one quantity: the first has no $s$, the second has no $v$, and the third has no $t$. To solve a problem, list what you know and what you want, then pick the equation that skips the quantity you neither know nor need.

| Equation | Relates | Leaves out |
|---|---|---|
| $v = u + at$ | $v, u, a, t$ | $s$ |
| $s = ut + \frac{1}{2}at^2$ | $s, u, a, t$ | $v$ |
| $v^2 = u^2 + 2as$ | $v, u, a, s$ | $t$ |

> [!EXAMPLE] Example 3.2 — Starting from rest
> A car starts from rest and accelerates uniformly at $2\ \text{m/s}^2$ for 10 s. Find its final velocity and the distance it covers.
>
> **Solution:** Here $u = 0$, $a = 2\ \text{m/s}^2$ and $t = 10$ s. From $v = u + at$, $v = 0 + 2 \times 10 = 20$ m/s.
>
> From $s = ut + \tfrac{1}{2}at^2$, $s = 0 + \tfrac{1}{2} \times 2 \times 10^2 = 100$ m.

## 3.5 Free Fall

Near the Earth's surface, and when air resistance can be ignored, every body falls with the same constant acceleration, about $9.8\ \text{m/s}^2$ downward.

- **Free fall**: motion under gravity alone, with a constant downward acceleration $g \approx 9.8\ \text{m/s}^2$ regardless of the body's mass.

Free fall is simply uniformly accelerated motion with $a = g$ pointing down, so the three equations of Section 3.4 apply directly. Choose a positive direction (up or down) at the start and keep the signs consistent.

> [!EXAMPLE] Example 3.3 — Throwing a ball upward
> A ball is thrown straight up at 19.6 m/s. Taking $g = 9.8\ \text{m/s}^2$, find the time it takes to reach the highest point and the maximum height.
>
> **Solution:** Take upward as positive, so $a = -9.8\ \text{m/s}^2$. At the top $v = 0$, so from $v = u + at$: $0 = 19.6 - 9.8t$, giving $t = 2$ s.
>
> From $v^2 = u^2 + 2as$: $0 = 19.6^2 - 2 \times 9.8 \times h$, so $h = \dfrac{384.16}{19.6} = 19.6$ m.

> [!THINK] Food for thought
> In 1971, astronaut David Scott dropped a hammer and a feather together on the Moon, and they hit the ground at the same moment. Why would the same experiment give a different result on Earth?
>
> **Discussion:** On the Moon there is no air, so both objects fall with the same acceleration. On Earth, air resistance has a much larger effect on the light, wide feather than on the heavy, compact hammer, so the feather falls more slowly.

## Worked Out Examples

> [!EXAMPLE] Example 3.4 — A train slowing down
> A train slows down uniformly from 30 m/s to 10 m/s while covering 400 m. Find its acceleration and the time taken.
>
> **Solution:** With $u = 30$ m/s, $v = 10$ m/s and $s = 400$ m, use $v^2 = u^2 + 2as$: $100 = 900 + 800a$, so $a = -1\ \text{m/s}^2$ (a deceleration of $1\ \text{m/s}^2$).
>
> Then $t = \dfrac{v - u}{a} = \dfrac{10 - 30}{-1} = 20$ s.

> [!EXAMPLE] Example 3.5 — A stone dropped from a tower
> A stone is dropped from the top of a 45 m tower. Taking $g = 10\ \text{m/s}^2$, find how long it takes to reach the ground and its speed just before impact.
>
> **Solution:** Take downward as positive with $u = 0$ and $a = 10\ \text{m/s}^2$. From $s = \tfrac{1}{2}at^2$: $45 = 5t^2$, so $t = 3$ s.
>
> The speed is $v = at = 10 \times 3 = 30$ m/s.

## Key Takeaways

- Distance is the length of the path; displacement is the change in position and has a direction.
- Average speed uses distance; average velocity uses displacement.
- Acceleration is the rate of change of velocity — the slope of the velocity–time graph.
- For constant acceleration, $v = u + at$, $s = ut + \frac{1}{2}at^2$ and $v^2 = u^2 + 2as$ (Section 3.4).
- In free fall every body has the same downward acceleration $g$, if air resistance is negligible.

## Questions for Short Answer

1. Can the average speed of a body be zero over an interval in which it moves?
2. Does a car's speedometer show average speed or instantaneous speed?
3. A ball is thrown vertically upward. What are its velocity and acceleration at the highest point?

## Objective I

1. A particle moves along the x-axis from $x = 2$ m to $x = -3$ m. Its displacement is
   - (a) 5 m
   - (b) −5 m
   - (c) 1 m
   - (d) −1 m
2. The slope of a velocity–time graph gives
   - (a) displacement
   - (b) speed
   - (c) acceleration
   - (d) distance
3. A body starts from rest with a uniform acceleration of $4\ \text{m/s}^2$. The distance it covers in the first 3 s is
   - (a) 6 m
   - (b) 12 m
   - (c) 18 m
   - (d) 36 m
4. A stone is dropped from rest. Taking $g = 10\ \text{m/s}^2$, its speed after 2 s is
   - (a) 10 m/s
   - (b) 20 m/s
   - (c) 40 m/s
   - (d) 5 m/s

## Objective II

1. Which of the following quantities can be negative?
   - (a) displacement
   - (b) distance
   - (c) velocity
   - (d) speed
2. A body moves with constant velocity. Which statements are true?
   - (a) Its acceleration is zero.
   - (b) Its speed is constant.
   - (c) The magnitude of its displacement equals the distance it travels.
   - (d) Its position does not change.

## Exercises

1. A cyclist covers 3 km in 10 minutes and then 2 km in 15 minutes. Find the average speed for the whole ride in km/h.
2. A car accelerates uniformly from 10 m/s to 30 m/s in 5 s. Find its acceleration and the distance covered in this time.
3. A stone is thrown vertically upward with a speed of 20 m/s. Taking $g = 10\ \text{m/s}^2$, find the maximum height reached and the total time before it returns to the thrower's hand.
4. A car moving at 72 km/h brakes with a uniform deceleration of $5\ \text{m/s}^2$. Find the distance it travels before stopping and the time taken.

## Answer Key

### Questions for Short Answer

1. No. If the body moves, it covers some distance, so its average speed is greater than zero. Its average *velocity* can be zero, though, if it returns to its starting point.
2. Instantaneous speed — the speed at that moment.
3. Its velocity is zero, and its acceleration is $g \approx 9.8\ \text{m/s}^2$ directed downward (see Section 3.5 and Example 3.3).

### Objective I

1. (b)
2. (c)
3. (c)
4. (b)

### Objective II

1. (a), (c)
2. (a), (b), (c)

### Exercises

1. 12 km/h — total distance 5 km in 25 min $= \frac{5}{12}$ h, so $5 \div \frac{5}{12} = 12$ km/h.
2. $a = 4\ \text{m/s}^2$; distance $= 100$ m — from $a = \frac{30 - 10}{5}$ and $s = \frac{10 + 30}{2} \times 5$, the same method as Example 3.2.
3. Maximum height 20 m; total time 4 s — from $h = \frac{u^2}{2g} = \frac{400}{20}$ and $t = \frac{2u}{g}$.
4. 40 m; 4 s — 72 km/h $= 20$ m/s, so $s = \frac{20^2}{2 \times 5} = 40$ m and $t = \frac{20}{5} = 4$ s.
