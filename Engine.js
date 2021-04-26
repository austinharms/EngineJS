const Component = function(paramObj) {
  this.parentObject = null;
  this.type = "BaseComponent";
  GameEngine.loadParameterObj(this, paramObj);
};

Component.prototype.setParent = function(obj) {
  this.parentObject = obj;
};

Component.prototype.getType = function() {
  return this.type;
};

Component.prototype.update = function() { };

const Animator = function (paramObj) {
  Component.call(this, {type:"Animator"});
  this.state = 0;
  this.sprite = null;
  this.animations = [];
  GameEngine.loadParameterObj(this, paramObj);
};

Animator.prototype = Object.create(Component.prototype);
Animator.prototype.constructor = Animator;

Animator.prototype.setSprite = function(sprite) {
  this.sprite = sprite;
};

Animator.prototype.update = function (engine, state, speed = 1) {
  if (state !== this.state)
    this.sprite.changeAnimation(engine, this.animations[state].frames, this.animations[state].width, this.animations[state].height, this.animations[state].speed, this.animations[state].renderMode, this.animations[state].xOffset, this.animations[state].yOffset);
  this.state = state;
  this.sprite.setSpeed(this.animations[state].speed * speed);
};

//Speed in FPS
const Sprite = function (paramObj, engine) {
  Component.call(this, {type:"Sprite"});
  this.imgSrc = [];
  this.width = 10;
  this.height = 10;
  this.speed = 1;
  this.xOffset = 0;
  this.yOffset = 0;
  this.renderMode = "no-repeat";
  GameEngine.loadParameterObj(this, paramObj);
  this.changeAnimation(engine, this.imgSrc, this.width, this.height, this.speed, this.renderMode, this.xOffset, this.yOffset);
  this.paused = false;
};

Sprite.prototype = Object.create(Component.prototype);
Sprite.prototype.constructor = Sprite;

Sprite.prototype.changeAnimation = function(engine, imgSrc, width = null, height = null, speed = null, renderMode = null, xOffset = null, yOffset = null) {
  if (Array.isArray(imgSrc))
    this.srcList = imgSrc;
  else
    this.srcList = [imgSrc];

  this.frames = [];
  this.renderMode = renderMode === null?this.renderMode:renderMode;
  this.srcList.forEach(imgSrc => {
    const img = new Image();
    img.src = imgSrc;
    img.height = this.height;
    img.width = this.width;
    this.frames.push(engine.canvasCTX.createPattern(img, this.renderMode));
  });

  this.frameTime = 1000/(speed === null?this.speed:speed);
  this.width = width?width:this.width;
  this.height = height?height:this.height;
  this.xOffset = (xOffset || xOffset === 0)?(xOffset - (this.width/2)):this.xOffset;
  this.yOffset = (yOffset || yOffset === 0)?(yOffset - (this.height/2)):this.yOffset;
  this.frameIndex = 0;
  this.lastFrame = performance.now();
};

Sprite.prototype.update = function (engine) {
  if (!this.paused) {
    const now = performance.now();
    if (now - this.lastFrame > this.frameTime) {
      ++this.frameIndex;
      this.lastFrame = now;
      if (this.frameIndex >= this.frames.length)
        this.frameIndex = 0;
    }
  }

  engine.canvasCTX.beginPath();
  engine.canvasCTX.rect(
    this.parentObject.x + this.xOffset,
    this.parentObject.y + this.yOffset,
    this.width,
    this.height
  );
  engine.canvasCTX.fillStyle = this.frames[this.frameIndex];
  engine.canvasCTX.fill();
  engine.canvasCTX.stroke();
};

Sprite.prototype.setSpeed = function (speed = 1) {
  this.frameTime = 1000/speed; //Speed is FPS
};

const BoxCollider = function (paramObj) {
  Component.call(this, {type:"Collider"});
  this.width = 10;
  this.height = 10;
  this.xOffset = 0;
  this.yOffset = 0;
  this.friction = [1,1,1,1];
  this.bounciness = [0,0,0,0];
  this.isTrigger = false;
  this.collisionFun = null;
  GameEngine.loadParameterObj(this, paramObj);
  this.xOffset = this.xOffset - (this.width / 2);
  this.yOffset = this.yOffset - (this.height / 2);
};

BoxCollider.prototype = Object.create(Component.prototype);
BoxCollider.prototype.constructor = BoxCollider;

BoxCollider.prototype.update = function (engine) {
  engine.canvasCTX.fillStyle = "#00AA00";
  engine.canvasCTX.beginPath();
  engine.canvasCTX.rect(
    this.parentObject.x + this.xOffset,
    this.parentObject.y + this.yOffset,
    this.width,
    this.height
  );
  engine.canvasCTX.stroke();
};

BoxCollider.prototype.isCollidingWith = function(collider, engine) {
  const x1 = this.parentObject.x + this.xOffset;
  const y1 = this.parentObject.y + this.yOffset;
  const x2 = collider.parentObject.x + collider.xOffset;
  const y2 = collider.parentObject.y + collider.yOffset;
  if (y1 + this.height >= y2 && y1 <= y2 + collider.height && x1 <= x2 + collider.width && x1 + this.width >= x2) {
    if (this.isTrigger) {
      this.collided({ colliderA: this, colliderB: collider }, engine);
      return false;
    }

    if (collider.isTrigger) {
      collider.collided({ colliderA: this, colliderB: collider }, engine);
      return false;
    }

    return { colliderA: this, colliderB: collider };
  }

  return false;
};

BoxCollider.prototype.onCollision = function(fun) {
  this.collisionFun = fun;
};

BoxCollider.prototype.collided = function(collision, engine) {
  if (this.collisionFun) this.collisionFun(collision, engine);
};

const PhysicsBody = function (paramObj) {
  Component.call(this, {type:"PhysicsBody"});
  this.gravity = 0.00098;
  this.mass = 1;
  this.xVelocity = 0;
  this.yVelocity = 0;
  this.xFriction = 0;
  this.yFriction = 0;
  this.inAir = true;
  this.collidingSide = PhysicsBody.SIDE.NONE;
  GameEngine.loadParameterObj(this, paramObj);
};

PhysicsBody.prototype = Object.create(Component.prototype);
PhysicsBody.prototype.constructor = PhysicsBody;

PhysicsBody.SIDE = Object.freeze({
  "NONE": -1,
  "TOP": 0,
  "BOTTOM": 1,
  "LEFT": 2,
  "RIGHT": 3,
});

PhysicsBody.prototype.update = function (engine) {
  const self = this;

  //Update Friction
  this.yVelocity += this.gravity * engine.deltaTime;
  if (this.yVelocity > 0) {
    this.yVelocity -= this.yFriction * this.mass * engine.deltaTime;
    if (this.yVelocity < 0) this.yVelocity = 0;
  } else {
    this.yVelocity += this.yFriction * this.mass * engine.deltaTime;
    if (this.yVelocity > 0) this.yVelocity = 0;
  }

  if (this.xVelocity > 0) {
    this.xVelocity -= this.xFriction * this.mass * engine.deltaTime;
    if (this.xVelocity < 0) this.xVelocity = 0;
  } else {
    this.xVelocity += this.xFriction * this.mass * engine.deltaTime;
    if (this.xVelocity > 0) this.xVelocity = 0;
  }

  this.xFriction = 0;
  this.yFriction = 0;

  //Apply Velocity
  this.parentObject.y += this.yVelocity * engine.deltaTime;
  this.parentObject.x += this.xVelocity * engine.deltaTime;

  //Check Collisions
  this.inAir = true;
  this.collidingSide = PhysicsBody.SIDE.NONE;
  let bottomCollision = false;
  let topCollision = false;
  engine.getAllColliders().forEach(collider => {
    if (collider.parentObject !== self.parentObject) {
      const collision = self.parentObject.getCollider().isCollidingWith(collider, engine);
      if (collision) {
        this.inAir = false;
        this.collidingSide = [
          {dist: Math.abs((collision.colliderB.parentObject.y + collision.colliderB.yOffset + collision.colliderB.height) - (collision.colliderA.parentObject.y + collision.colliderA.yOffset)), side: PhysicsBody.SIDE.TOP },
          {dist: Math.abs((collision.colliderA.parentObject.y + collision.colliderA.yOffset + collision.colliderA.height) - (collision.colliderB.parentObject.y + collision.colliderB.yOffset)), side: PhysicsBody.SIDE.BOTTOM },
          {dist: Math.abs((collision.colliderB.parentObject.x + collision.colliderB.xOffset + collision.colliderB.width) - (collision.colliderA.parentObject.x + collision.colliderA.xOffset)), side: PhysicsBody.SIDE.LEFT },
          {dist: Math.abs((collision.colliderA.parentObject.x + collision.colliderA.xOffset + collision.colliderA.width) - (collision.colliderB.parentObject.x + collision.colliderB.xOffset)), side: PhysicsBody.SIDE.RIGHT },
        ].sort((a, b) => a.dist - b.dist).shift().side;

        switch(this.collidingSide) {
          case PhysicsBody.SIDE.TOP:
            self.xFriction = collision.colliderA.friction[this.collidingSide] + collision.colliderB.friction[this.collidingSide];
            self.yVelocity *= -1 * (collision.colliderA.bounciness[this.collidingSide] + collision.colliderB.bounciness[this.collidingSide]);
            collision.colliderA.parentObject.y = -collision.colliderA.yOffset + (collision.colliderB.parentObject.y + collision.colliderB.yOffset + collision.colliderB.height);
            topCollision = true;
            break;

          case PhysicsBody.SIDE.BOTTOM:
            self.xFriction = collision.colliderA.friction[this.collidingSide] + collision.colliderB.friction[this.collidingSide];
            self.yVelocity *= -1 * (collision.colliderA.bounciness[this.collidingSide] + collision.colliderB.bounciness[this.collidingSide]);
            collision.colliderA.parentObject.y = -collision.colliderA.yOffset - collision.colliderA.height + (collision.colliderB.parentObject.y + collision.colliderB.yOffset);
            bottomCollision = true;
            break;

          case PhysicsBody.SIDE.LEFT:
            self.yFriction = collision.colliderA.friction[this.collidingSide] + collision.colliderB.friction[this.collidingSide];
            self.xVelocity *= -1 * (collision.colliderA.bounciness[this.collidingSide] + collision.colliderB.bounciness[this.collidingSide]);
            collision.colliderA.parentObject.x = -collision.colliderA.xOffset + (collision.colliderB.parentObject.x + collision.colliderB.xOffset + collision.colliderB.width);
            break;

          case PhysicsBody.SIDE.RIGHT:
            self.yFriction = collision.colliderA.friction[this.collidingSide] + collision.colliderB.friction[this.collidingSide];
            self.xVelocity *= -1 * (collision.colliderA.bounciness[this.collidingSide] + collision.colliderB.bounciness[this.collidingSide]);
            collision.colliderA.parentObject.x = -collision.colliderA.xOffset - collision.colliderA.width + (collision.colliderB.parentObject.x + collision.colliderB.xOffset);
            break;
        }
      }
    }
  });

  if (bottomCollision)
    this.collidingSide = PhysicsBody.SIDE.BOTTOM;
  if (topCollision)
    this.inAir = true;
};

PhysicsBody.prototype.getOnGround = function() {
  return !this.inAir;
};

PhysicsBody.prototype.getCollidingSide = function() {
  return this.collidingSide;
};

const GameObject = function (paramObj) {
  this.x = 0;
  this.y = 0;
  this.enabled = true;
  this.sprite = null;
  this.collider = null;
  this.physicsBody = null;
  this.animator = null;
  this.components = [];
  this.type = "GameObject";
  this.id = null;
  this.updatePriority = 1;
  GameEngine.loadParameterObj(this, paramObj);
};

GameObject.prototype.getID = function() {
  return this.id;
};

GameObject.prototype.setID = function(id) {
  this.id = id;
};

GameObject.prototype.setEnabled = function(en) {
  this.enabled = en;
};

GameObject.prototype.getEnabled = function() {
  return this.enabled;
};

GameObject.prototype.addComponent = function(component) {
  if (component && component instanceof Component) {
    component.setParent(this);
    switch(component.getType()) {
      case "Sprite":
        this.sprite = component;
        break;

      case "Animator":
        if (this.sprite != null) {
          component.setSprite(this.sprite);
          this.animator = component;
        }
        break;

      case "Collider":
        this.collider = component;
        break;

      case "PhysicsBody":
        if (this.collider != null)
          this.physicsBody = component;
        break;

      default:
        this.components.push(component);
        break;
    }
  }
};

GameObject.prototype.update = function (engine) {
  if (this.physicsBody !== null)
    this.physicsBody.update(engine);
  if (this.collider !== null && this.sprite === null)
    this.collider.update(engine);
  if (this.sprite !== null)
    this.sprite.update(engine);

  this.components.forEach((c) => c.update(engine));
};

GameObject.prototype.getType = function() {
  return this.type;
};

GameObject.prototype.setType = function(t) {
  this.type = t;
};

GameObject.prototype.getCollider = function() {
  return this.collider;
};

GameObject.prototype.stop = function() { };

const Player = function(paramObj) {
  GameObject.call(this, {type:"Player"});
  this.updatePriority = 3;
  GameEngine.loadParameterObj(this, paramObj);
  const self = this;
  this.input = {};
  this.events = [
    {
      type: "keydown",
      fun: e => {
        self.input[e.keyCode] = true;
        e.preventDefault();
      },
    },
    {
      type: "keyup",
      fun: e => {
        self.input[e.keyCode] = false;
        e.preventDefault();
      },
    },
  ];

  this.events.forEach(e => document.addEventListener(e.type, e.fun));
};

Player.prototype = Object.create(GameObject.prototype);
Player.prototype.constructor = Player;

Player.prototype.update = function (engine) {
  if (this.y > 700) {
    engine.stop();
    return;
  }

  if (this.input[39])
    this.physicsBody.xVelocity = 0.06;
  else if (this.input[37])
    this.physicsBody.xVelocity = -0.06;

  if (this.input[38] && this.physicsBody !== null && this.physicsBody.getOnGround())
    this.physicsBody.yVelocity = -0.3;

  if (this.animator !== null && this.physicsBody !== null) {
    let state = 0;
    let speed = 1;
    switch (this.physicsBody.getCollidingSide()) {
      case PhysicsBody.SIDE.NONE:
        state = 1;
        if (Math.abs(this.physicsBody.xVelocity) > 0.002) {
          if (this.physicsBody.xVelocity >= 0)
            state = 2;
          else 
            state = 3;
        }
        break;

      case PhysicsBody.SIDE.TOP:
        state = 4;
        break;

      case PhysicsBody.SIDE.LEFT:
        state = 5;
        break;
        
      case PhysicsBody.SIDE.RIGHT:
        state = 6;
        break;

      case PhysicsBody.SIDE.BOTTOM:
        if (Math.abs(this.physicsBody.xVelocity) > 0.001) {
          if (this.physicsBody.xVelocity > 0) {
            state = 7;
            speed = this.physicsBody.xVelocity * 100;
          } else {
            state = 8;
            speed = this.physicsBody.xVelocity * -100;
          }
        }
        break;
    }

    this.animator.update(engine, state, speed);
  }

  GameObject.prototype.update.call(this, engine);
};

Player.prototype.getColliders = function() {
  return this.colliders;
};

Player.prototype.stop = function() {
  this.events.forEach(e => document.removeEventListener(e.type, e.fun));
};

const Camera = function(paramObj) {
  GameObject.call(this, {type:"Camera"});
  this.targetObj = null;
  this.updatePriority = 2;
  GameEngine.loadParameterObj(this, paramObj);
};

Camera.prototype = Object.create(GameObject.prototype);
Camera.prototype.constructor = Camera;

Camera.prototype.update = function (engine) {
  if (this.targetObj !== null) {

  }

  GameObject.prototype.update.call(this, engine);
};

Camera.prototype.setTarget = function(...params) {
  if (params.length === 1) {
    if (params[0] instanceof GameObject) {
      this.targetObj = obj;
    } else {
      const obj = GameEngine.getGameObjectByID(params[0]);
      if (obj !== undefined)
        this.targetObj = obj;
    }
    
  } else if (params.length == 2) {
    this.x = params[0];
    this.y = params[1];
    this.targetObj = null;
  }
};

const GameEngine = function (canvas, levelData, customPrefabs = null) {
  this.canvas = canvas;
  this.canvasCTX = canvas.getContext("2d");
  this.gameObjects = [];
  this.coinCount = 0;
  canvas.width = 600;
  canvas.height = 400;
  this.deltaTime = 0;
  this.lastFrame = performance.now();
  this.updateInterval = setInterval(this.update.bind(this), 1);
  this.coinCount = 0;
  this.endFun = null;
  this.hasWon = false;
  this.background = null;

  window.addEventListener("resize", this.resizeCanvas.bind(this), false);
  this.resizeCanvas();
  this.clearScreen();

  if (levelData) {
    this.levelTime = levelData.time;
    this.addGameObject(...levelData.objects.map(obj => {
        if (customPrefabs !== null && customPrefabs.hasOwnProperty(obj.type))
          return customPrefabs[obj.type](obj.params, this);
        return GameEngine.PREFABS[obj.type](obj.params, this);
      })
    );
  } else {
    this.levelTime = 10000;
  }
  this.gameStartTime = performance.now();
};

GameEngine.loadParameterObj = function(callingObj, paramObj) {
  if (!paramObj || typeof paramObj !== "object" || Array.isArray(paramObj)) return;
  for (const key in paramObj)
    callingObj[key] = paramObj[key];
};

GameEngine.prototype.getGameObjectByID = function(id) {
  return this.gameObjects.find(obj => obj.id === id);
};

GameEngine.prototype.onEnd = function(fun) {
  this.endFun = fun;
};

GameEngine.prototype.getWon = function() {
  return this.hasWon;
};

GameEngine.prototype.getTime = function() {
  if (this.time) return this.time;
  return performance.now() - this.gameStartTime;
};

GameEngine.prototype.setWon = function() {
  this.hasWon = true;
};

GameEngine.prototype.addCoin = function() {
  ++this.coinCount;
};

GameEngine.prototype.getCoins = function() {
  return this.coinCount;
};

GameEngine.prototype.clearScreen = function () {
  this.canvasCTX.fillStyle = "#AAAAAA";
  this.canvasCTX.clearRect(0, 0, this.canvas.width, this.canvas.height);
  if (this.background !== null)
    this.background.update(this);
};

GameEngine.prototype.update = function () {
  const engine = this;
  const now = performance.now();

  if (now - this.gameStartTime >= this.levelTime) {
    this.stop();
    return;
  }

  this.deltaTime = now - this.lastFrame;
  this.lastFrame = now;
  this.clearScreen();
  this.gameObjects.forEach((gameObject) => { if(gameObject.getEnabled()) gameObject.update(engine)});
};

GameEngine.prototype.updatePrioritys = function() {
  this.gameObjects.sort((a, b) => b.updatePriority - a.updatePriority);
};

GameEngine.prototype.addGameObject = function (...gameObjects) {
    gameObjects.forEach(gameObject => {
    if (gameObject && gameObject instanceof GameObject)
      this.gameObjects.push(gameObject); 
  });
  this.updatePrioritys();
};

GameEngine.prototype.getAllColliders = function() {
  const colliders = [];
  this.gameObjects.forEach(gameObject => {if (gameObject.getEnabled() && gameObject.getCollider() !== null) colliders.push(gameObject.getCollider());});
  return colliders;
};

GameEngine.prototype.resizeCanvas = function () {
  const ratio = Math.min(window.innerWidth / 600, window.innerHeight / 400);
  this.canvas.style.width = (this.canvas.width * ratio) + "px";
  this.canvas.style.height = (this.canvas.height * ratio) + "px";
};

GameEngine.prototype.stop = function() {
  clearInterval(this.updateInterval);
  this.gameObjects.forEach(gameObject => gameObject.stop());
  this.time = performance.now - this.gameStartTime;
  if (this.endFun) this.endFun(this);
};

GameEngine.PREFABS = Object.freeze({
  Player: function(params, engine) {
    if (params.hasOwnProperty("components")) {
      const components = params.components;
      delete params.components;
      const player = new Player(params, engine);
      components.forEach(c => player.addComponent(GameEngine.PREFABS[c.type](c.params, engine)));
      return player;
    }
    
    return new Player(params, engine);
  },
  GameObject: function(params, engine) {
    if (params.hasOwnProperty("components")) {
      const components = params.components;
      delete params.components;
      const obj = new GameObject(params, engine);
      components.forEach(c => obj.addComponent(GameEngine.PREFABS[c.type](c.params, engine)));
      return obj;
    }
    
    return new GameObject(params, engine);
  },
  BoxCollider: function(params, engine) {
    return new BoxCollider(params, engine);
  },
  Animator: function(params, engine) {
    return new Animator(params, engine);
  },
  Sprite: function(params, engine) {
    return new Sprite(params, engine);
  },
  PhysicsBody: function(params, engine) {
    return new PhysicsBody(params, engine);
  }
});
