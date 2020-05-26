const g = 10;
const globalStyle = getComputedStyle(document.body);

function getCoords(ctx, position) {
  return {
    x: (ctx.canvas.width * (1 + position.x)) / 2,
    y: ctx.canvas.height - (ctx.canvas.width * (1 + position.y)) / 2,
  };
}
function getLength(ctx, length) {
  return (ctx.canvas.width * length) / 2;
}

class JugglerRenderer {
  constructor(juggler) {
    this.juggler = juggler;
    this.main_div = document.createElement("div");
    this.main_div.setAttribute("style", "display: flex;");
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("width", "100");
    this.svg.setAttribute("height", "150");
    this.svg.setAttribute("viewBox", "-50, -100, 100, 150");
    this.svg.style.width = "200px";
    this.svg.style.height = "300px";
    this.main_div.appendChild(this.svg);

    let juggler_body = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );
    juggler_body.classList.add("juggler-body");
    juggler_body.setAttribute("points", "-30,-10 30,-10 20,40 -20,40");
    this.svg.appendChild(juggler_body);

    let juggler_head = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "ellipse"
    );
    juggler_head.classList.add("juggler-body");
    juggler_head.setAttribute("cx", "0");
    juggler_head.setAttribute("cy", "-30");
    juggler_head.setAttribute("rx", "12");
    juggler_head.setAttribute("ry", "15");
    this.svg.appendChild(juggler_head);

    this.juggler_arm_left = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline"
    );
    this.juggler_arm_left.classList.add("juggler-arm");
    this.svg.appendChild(this.juggler_arm_left);

    this.juggler_arm_right = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline"
    );
    this.juggler_arm_right.classList.add("juggler-arm");
    this.svg.appendChild(this.juggler_arm_right);

    this.balls = [];
    this.juggler.eventManager.balls.forEach((ball) => {
      let new_ball = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      new_ball.classList.add("juggler-ball");
      new_ball.setAttribute("r", "6");
      this.balls.push(new_ball);
      this.svg.appendChild(new_ball);
    });
    this.update(0);
  }
  update(deltaTime) {
    this.juggler.eventManager.update(deltaTime);
    let time = this.juggler.eventManager.time;

    let lhand_pos = this.juggler.eventManager.lhand.getPosition(time);
    let lelbow_pos = { x: -0.7 - (-0.7 - lhand_pos.x) / 2, y: -0.3 };
    this.juggler_arm_left.setAttribute(
      "points",
      `0,-10 -30,-10 ${lelbow_pos.x * 50},${-lelbow_pos.y * 50} ${
        lhand_pos.x * 50
      },${-lhand_pos.y * 50}`
    );

    let rhand_pos = this.juggler.eventManager.rhand.getPosition(time);
    let relbow_pos = { x: 0.7 - (0.7 - rhand_pos.x) / 2, y: -0.3 };
    this.juggler_arm_right.setAttribute(
      "points",
      `0,-10 30,-10 ${relbow_pos.x * 50},${-relbow_pos.y * 50} ${
        rhand_pos.x * 50
      },${-rhand_pos.y * 50}`
    );

    for (let i = 0; i < this.balls.length; i++) {
      let position = this.juggler.eventManager.balls[i].getPosition(time);
      this.balls[i].setAttribute("cx", position.x * 50);
      this.balls[i].setAttribute("cy", -position.y * 50);
    }
  }
}

class Juggler {
  constructor(data) {
    let balls = [];
    let lhandBalls = [];
    let rhandBalls = [];
    let lhand = new Hand(lhandBalls, { x: -0.5, y: -0.4 });
    let rhand = new Hand(rhandBalls, { x: 0.5, y: -0.4 });
    for (let i = 0; i < data[1]; i++) {
      let ball = new Ball(lhand);
      lhandBalls.push(ball);
      balls.push(ball);
    }
    for (let i = data[1]; i < data[0]; i++) {
      let ball = new Ball(rhand);
      rhandBalls.push(ball);
      balls.push(ball);
    }

    this.eventManager = new EventManager(data, lhand, rhand, balls);
  }
}
const BallStates = {
  HELD: 1,
  IN_AIR: 2,
};
const EventTypes = {
  CATCH: 1,
  THROW: 2,
  MOVE: 3,
  ENDMOVE: 4,
};
class HandEvent {
  constructor(type, ball, hand, destination, curve, pairedEvent) {
    this.type = type;
    this.ball = ball;
    this.hand = hand;
    this.curve = curve;
    this.destination = destination;
    this.pairedEvent = pairedEvent;
  }
  offset(deltaTime) {
    this.curve.offset += deltaTime;
  }
  getEventTime() {
    if (this.type === EventTypes.THROW || this.type === EventTypes.MOVE) {
      return this.curve.offset;
    }
    if (this.type === EventTypes.CATCH || this.type === EventTypes.ENDMOVE) {
      return this.curve.offset + this.curve.length;
    }
  }
}
class EventManager {
  constructor(data, lhand, rhand, balls) {
    this.time = 0;
    this.lhandEvents = [];
    this.rhandEvents = [];
    this.lhand = lhand;
    this.rhand = rhand;
    this.balls = balls;
    this.data = data;
    let i = 2;
    while (data[i][0] !== "loop") {
      this.parseEvents(data[i], 0);
      i++;
    }
    this.loop = data[i];
    this.loopStart = this.loop[1];
    this.loopEnd = this.loop[2];
    i = 3;
    while (i < this.loop.length) {
      this.parseEvents(this.loop[i], 0);
      this.parseEvents(this.loop[i], this.loopEnd - this.loopStart);
      i++;
    }
  }
  parseEvents(data, offset) {
    if (data[0] === "t") {
      let source, destination;
      if (data[1] === "l") source = this.lhand;
      else if (data[1] == "r") source = this.rhand;

      if (data[2] === "l") destination = this.lhand;
      else destination = this.rhand;
      let event1 = new HandEvent(
        EventTypes.THROW,
        undefined,
        source,
        destination,
        new Parabola(
          { x: data[3], y: data[4] },
          { x: data[5], y: data[6] },
          data[8] - data[7],
          data[7]
        ),
        undefined
      );
      let event2 = new HandEvent(
        EventTypes.CATCH,
        undefined,
        destination,
        undefined,
        new Parabola(
          { x: data[3], y: data[4] },
          { x: data[5], y: data[6] },
          data[8] - data[7],
          data[7]
        ),
        event1
      );
      event1.pairedEvent = event2;
      event1.offset(offset);
      event2.offset(offset);
      if (event1.hand === this.lhand) {
        this.lhandEvents.push(event1);
      } else {
        this.rhandEvents.push(event1);
      }

      if (event2.hand === this.lhand) {
        this.lhandEvents.push(event2);
      } else {
        this.rhandEvents.push(event2);
      }
    } else if (data[0] == "m") {
      let source;
      if (data[1] === "l") source = this.lhand;
      else if (data[1] == "r") source = this.rhand;
      let event1 = new HandEvent(
        EventTypes.MOVE,
        undefined,
        source,
        undefined,
        this.parseCurve(data[2]),
        undefined
      );
      let event2 = new HandEvent(
        EventTypes.ENDMOVE,
        undefined,
        source,
        undefined,
        this.parseCurve(data[2]),
        event1
      );
      event1.pairedEvent = event2;
      event1.offset(offset);
      event2.offset(offset);
      if (source === this.lhand) {
        this.lhandEvents.push(event1, event2);
      } else {
        this.rhandEvents.push(event1, event2);
      }
    }
  }
  getClosestEvent(eventQueue) {
    if (eventQueue.length > 0) {
      let minTime = eventQueue[0].getEventTime();
      let nextEvent = 0;
      eventQueue.forEach((event, index) => {
        if (event.getEventTime() < minTime) {
          minTime = event.getEventTime();
          nextEvent = index;
        }
      });
      let ans = eventQueue[nextEvent];
      eventQueue.splice(nextEvent, 1);
      return ans;
    } else return undefined;
  }
  parseCurve(data) {
    if (data.length === 4) {
      return new Point({ x: data[0], y: data[1] }, data[3] - data[2], data[2]);
    } else if (data.length === 6) {
      return new Parabola(
        { x: data[0], y: data[1] },
        { x: data[2], y: data[3] },
        data[5] - data[4],
        data[4]
      );
    }
  }
  offset(deltaTime) {
    this.time += deltaTime;
    this.lhand.offset(deltaTime);
    this.rhand.offset(deltaTime);
    this.lhandEvents.forEach((event) => {
      event.offset(deltaTime);
    });
    this.rhandEvents.forEach((event) => {
      event.offset(deltaTime);
    });
    this.balls.forEach((ball) => {
      ball.offset(deltaTime);
    });
  }
  update(deltaTime) {
    this.time += deltaTime;
    while (this.time > this.loopEnd) {
      this.offset(this.loopStart - this.loopEnd);
      for (let i = 3; i < this.loop.length; i++) {
        this.parseEvents(this.loop[i], this.loopEnd - this.loopStart);
      }
    }
    while (
      this.lhand.getNextEventTime() <= this.time ||
      this.rhand.getNextEventTime() <= this.time
    ) {
      if (this.rhand.getNextEventTime() <= this.lhand.getNextEventTime())
        this.rhand.update(this.getClosestEvent(this.rhandEvents));
      else this.lhand.update(this.getClosestEvent(this.lhandEvents));
    }
  }
}
class Hand {
  constructor(balls, pos) {
    this.balls = balls;
    this.curve = new Point(pos, 1, -1);
  }
  update(nextEvent) {
    this.prevEvent = this.nextEvent;
    this.nextEvent = nextEvent;
    if (
      this.prevEvent !== undefined &&
      (this.prevEvent.type === EventTypes.THROW ||
        this.prevEvent.type === EventTypes.CATCH)
    ) {
      this.prevEvent.ball.update(this.prevEvent);
    }
    switch (nextEvent.type) {
      case EventTypes.THROW:
        this.curve = new WildCurve(
          this.curve.getSpeed(this.curve.offset + this.curve.length),
          this.curve.getPosition(this.curve.offset + this.curve.length),
          nextEvent.curve.getSpeed(nextEvent.curve.offset),
          nextEvent.curve.getPosition(nextEvent.curve.offset),
          this.curve.offset + this.curve.length,
          nextEvent.curve.offset
        );
        this.nextEvent.ball = this.balls.pop();
        this.nextEvent.pairedEvent.ball = this.nextEvent.ball;
        break;
      case EventTypes.CATCH:
        this.curve = new WildCurve(
          this.curve.getSpeed(this.curve.offset + this.curve.length),
          this.curve.getPosition(this.curve.offset + this.curve.length),
          nextEvent.curve.getSpeed(
            nextEvent.curve.offset + nextEvent.curve.length
          ),
          nextEvent.curve.getPosition(
            nextEvent.curve.offset + nextEvent.curve.length
          ),
          this.curve.offset + this.curve.length,
          nextEvent.curve.offset + nextEvent.curve.length
        );
        this.balls.push(this.nextEvent.ball);
        break;
      case EventTypes.MOVE:
        this.curve = new WildCurve(
          this.curve.getSpeed(this.curve.offset + this.curve.length),
          this.curve.getPosition(this.curve.offset + this.curve.length),
          nextEvent.curve.getSpeed(nextEvent.curve.offset),
          nextEvent.curve.getPosition(nextEvent.curve.offset),
          this.curve.offset + this.curve.length,
          nextEvent.curve.offset
        );
        break;
      case EventTypes.ENDMOVE:
        this.curve = this.prevEvent.curve;
        break;
    }
  }
  offset(deltaTime) {
    if (this.nextEvent !== undefined) {
      if (this.nextEvent.type !== EventTypes.ENDMOVE)
        this.curve.offset += deltaTime;
      this.nextEvent.offset(deltaTime);
    }
  }
  getNextEventTime() {
    if (this.nextEvent !== undefined) return this.nextEvent.getEventTime();
    else return -Infinity;
  }
  getPosition(time) {
    return this.curve.getPosition(time);
  }
}
class Ball {
  constructor(hand) {
    this.state = BallStates.HELD;
    this.hand = hand;
  }
  update(handEvent) {
    switch (handEvent.type) {
      case EventTypes.THROW:
        this.state = BallStates.IN_AIR;
        this.curve = handEvent.curve;
        break;
      case EventTypes.CATCH:
        this.state = BallStates.HELD;
        this.hand = handEvent.hand;
        break;
    }
  }
  offset(deltaTime) {
    if (this.state === BallStates.IN_AIR) this.curve.offset += deltaTime;
  }
  getPosition(time) {
    if (this.state === BallStates.HELD) {
      return this.hand.getPosition(time);
    } else if (this.state === BallStates.IN_AIR) {
      return this.curve.getPosition(time);
    }
  }
}
class Curve {
  constructor(length, offset) {
    this.length = length;
    this.offset = offset;
  }
  getPosition(time) {}
  getSpeed(time) {}
}

class WildCurve extends Curve {
  constructor(v0, p0, v1, p1, t0, t1) {
    let t = t1 - t0;
    super(t, t0);
    this.a = {
      x: (v0.x + v1.x) / (t * t) - (2 * (p1.x - p0.x)) / (t * t * t),
      y: (v0.y + v1.y) / (t * t) - (2 * (p1.y - p0.y)) / (t * t * t),
    };
    this.b = {
      x: (3 * (p1.x - p0.x)) / (t * t) - (2 * v0.x + v1.x) / t,
      y: (3 * (p1.y - p0.y)) / (t * t) - (2 * v0.y + v1.y) / t,
    };
    this.c = v0;
    this.d = p0;
  }
  getPosition(t) {
    let time = t - this.offset;
    let time2 = time * time;
    let time3 = time2 * time;
    return {
      x: this.a.x * time3 + this.b.x * time2 + this.c.x * time + this.d.x,
      y: this.a.y * time3 + this.b.y * time2 + this.c.y * time + this.d.y,
    };
  }
  getSpeed(t) {
    let time = t - this.offset;
    let time2 = time * time;
    return {
      x: 3 * this.a.x * time2 + 2 * this.b.x * time + this.c.x,
      y: 3 * this.a.y * time2 + 2 * this.b.y * time + this.c.y,
    };
  }
}
class Point extends Curve {
  constructor(p, length, offset) {
    super(length, offset);
    this.p = p;
  }
  getPosition(time) {
    return { x: this.p.x, y: this.p.y };
  }
  getSpeed(time) {
    return { x: 0, y: 0 };
  }
}
class Parabola extends Curve {
  constructor(p0, p1, length, offset) {
    super(length, offset);
    this.a = { x: 0, y: -0.5 * g };
    this.b = {
      x: (p1.x - p0.x) / length,
      y: (p1.y - p0.y) / length + 0.5 * g * length,
    };
    this.c = { x: p0.x, y: p0.y };
  }
  getPosition(t) {
    let time = t - this.offset;
    return {
      x: this.b.x * time + this.c.x,
      y: this.a.y * time * time + this.b.y * time + this.c.y,
    };
  }
  getSpeed(t) {
    let time = t - this.offset;
    return {
      x: this.b.x,
      y: 2 * this.a.y * time + this.b.y,
    };
  }
}

//Placement of jugglers in DOM

let juggler_renderers = [];

document.querySelectorAll("trick").forEach((element) => {
  element.style.display = "overlay";
  let renderer = new JugglerRenderer(new Juggler(eval(element.textContent)));
  element.innerHTML = "";
  element.appendChild(renderer.main_div);
  juggler_renderers.push(renderer);
});

const FPS = 60;

if (juggler_renderers.length != 0) {
  setInterval(() => {
    juggler_renderers.forEach((renderer) => {
      renderer.update(1 / FPS);
    });
  }, 1000 / FPS);
}

console.log(juggler_renderers);
