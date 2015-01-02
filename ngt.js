'use strict';

if (typeof String.startsWith == 'undefined') {
  String.prototype.startsWith = function (prefix) {
    return this.indexOf(prefix) === 0;
  }
}

if (typeof String.endsWith == 'undefined') {
  String.prototype.endsWith = function (suffix) {
    return this.match(suffix + '$') == suffix;
  }
}

function Engine (options) {
  var self = this;

  options = options || {};
  options.assets = options.assets || '';
  options.screen = options.screen || {};
  options.screen.width = options.screen.width || 2048;
  options.screen.height = options.screen.height || 1536;
  options.interact = options.interact || function(id) {};

  var data = self.data = {};
  data.tick = 0;
  data.entities = {};
  data.nextEntityId = 1;

  var runtime = self.runtime = {};
  runtime.debug = false;
  runtime.screen = {};
  runtime.index = {};
  runtime.index.name = {};

  if (options.log) {
    console.log('Indexing entities by ' + Object.keys(runtime.index).join(', '));
  }

  runtime.components = {};
  runtime.components.image = [];
  runtime.components.position = [];
  runtime.components.scale = [];
  runtime.components.size = [];
  runtime.components.bounds = [];
  runtime.components.rectangle = [];

  if (options.log) {
    console.log('Storing components by ' + Object.keys(runtime.components).join(', '));
  }
  runtime.phaser = {};
  runtime.phaser.sprites = {};
  runtime.phaser.objects = {};
  runtime.phaser.rectangles = {};

  var phaser;

  function findInteract(entity) {
    if (entity) {
      if (entity.interact === false) {
        return false;
      }
      if (entity.interact) {
        return entity.interact;
      }
      if (entity.parent) {
        var parent = data.entities[entity.parent]
        return findInteract(parent);
      }
    }
  }

  if (typeof (self.simulate == 'undefined')) {
    Engine.prototype.simulate = function () {
      var startTick = data.tick;
      while (self.nextUpdateTime < new Date().getTime()) {
        data.tick++;
        self.nextUpdateTime += self.skip;
      }

      if (self.simulating) {
        requestAnimationFrame(self.simulate);
      }
    };
  }

  if (typeof (self.makeEntity == 'undefined')) {
    Engine.prototype.makeEntity = function (template) {
      template.id = data.nextEntityId++;

      return template;
    };
  }

  if (typeof (self.addEntity == 'undefined')) {
    Engine.prototype.addEntity = function (template) {
      var entity = self.makeEntity(template);

      for (var key in entity) {
        var component = entity[key];
        if (runtime.index[key]) {
          runtime.index[key][component] = entity.id;
        }
        if (runtime.components[key]) {
          var components = runtime.components[key] || [];
          components.push(entity.id);
          runtime.components[key] = components;
        }
      }

      if (entity.position) {
        entity.position.x = entity.position.x || 0;
        entity.position.y = entity.position.y || 0;
        entity.position.z = entity.position.z || 0;
      }

      var parts = entity.name.split('/');
      if (parts.length > 1) {
        entity.parent = runtime.index.name[parts.splice(0, parts.length - 1).join('/')];
      }
      data.entities[entity.id] = entity;
      var parent = data.entities[entity.parent] || {name: '<stage>'};

      if (options.log) {
        console.log('Created entity ' + entity.id + ' "'  + entity.name + '" parent "' + parent.name + '"');
      }

      self.nextUpdateTime = new Date().getTime();
      self.fps = 25;
      self.skip = 1000 / self.fps;
    };
  }


  if (typeof (self.start == 'undefined')) {
    Engine.prototype.start = function() {
      phaser = self.phaser = new Phaser.Game(options.screen.width, options.screen.height, Phaser.CANVAS, 'canvas', { preload: self.preload, create: self.create, update: self.update, render: self.render });
    };
  }

  if (typeof (self.visible == 'undefined')) {
    Engine.prototype.visible = function (path, enabled) {
      for (var key in data.entities) {
        var entity = data.entities[key];
        var name = entity.name;
        var group = runtime.phaser.objects[entity.id];
        if (group && name.startsWith(path)) {
          group.visible = enabled;
        }
      }
    };
  }

  if (typeof (self.addEntities == 'undefined')) {
    Engine.prototype.addEntities = function(entities) {
      for (var i in entities) {
        var e = entities[i];
        self.addEntity(e);
      }

      for (var key in runtime.components) {
        runtime.components[key].sort();
      }
    };
  }

  if (typeof (self.findParentWithPhaser == 'undefined')) {
    Engine.prototype.findParentWithPhaser = function(entity) {
      while (entity) {
        if (runtime.phaser.objects[entity.parent]) {
          return data.entities[entity.parent];
        }
        entity = data.entities[entity.parent];
      }
    };
  }

  if (typeof (self.preload == 'undefined')) {
    Engine.prototype.preload = function () {
      if (options.log) {
        console.log('Loading...');
      }

      if (options.preload) {
        options.preload();
      }

      var images = {};
      for (var key in runtime.components.image) {
        var id = runtime.components.image[key];
        var entity = data.entities[id];
        var name = entity.image.name || entity.name;
        name = name.replace(/#\d+/g, '');
        var defaultExt = (entity.name.endsWith('background') ? '.jpg' : '.png');
        var defaultSrc = (options.assets + 'images/' + entity.name.replace(/\//g, '_')).replace(/#\d+/g, '');
        var src = entity.image.src || defaultSrc + defaultExt;
        if (options.log) {
          console.log('Loading texture "' + name + '" from "' + src + '"');
        }
        if (!images[name]) {
          images[name] = src;
        }
      }

      for (var name in images) {
        var src = images[name];
        phaser.load.image(name, src);
      }
    };
  }

  if (typeof (self.updateEntity == 'undefined')) {
    Engine.prototype.makeUpdateEntity = function (entity) {
      return function() {
        var group = runtime.phaser.objects[entity.id];
        var sprite = runtime.phaser.sprites[entity.id];

        var position = entity.position;
        var rotation = entity.rotation;
        var pivot = entity.pivot;
        var size = entity.size;
        var scale = entity.scale;
        var image = entity.image;
        var crop = entity.crop;
        var rectangle = entity.rectangle;

        if (position) {
          if (pivot) {
            group.x = position.x + pivot.x;
            group.y = position.y + pivot.y;
          } else {
            group.x = position.x;
            group.y = position.y;
          }
        }

        if (rotation) {
          group.angle = rotation.angle;
        }

        if (size) {
          group.width = size.width || options.screen.width;
          group.height = size.height || options.screen.height;

          if (sprite) {
            sprite.width = size.width;
            sprite.height = size.height;
          }
        }

        if (scale) {
          group.scale.x = scale.x;
          group.scale.y = scale.y;
        }

        if (image) {
          if (pivot) {
            var sprite = runtime.phaser.sprites[entity.id];
            sprite.x = -pivot.x;
            sprite.y = -pivot.y;
          }

          if (sprite) {
            if (image.flip) {
              sprite.scale.x = -1;
              sprite.x = -sprite.x;
            } else {
              sprite.scale.x = 1;
            }
            var opacity = ('opacity' in entity ? entity.opacity : 1.0);
            sprite.alpha = opacity;

            if (rectangle) {
              var rect = runtime.phaser.rectangles[entity.id];
              rect.alpha = opacity * rectangle.opacity;
            }

            if (crop) {
              var r = new Phaser.Rectangle();
              r.x = crop.x;
              r.y = crop.y;
              r.width = crop.width;
              r.height = crop.height;
              sprite.crop(r);
            }
          }
        }
      };
    };
  }

  function dragEntityStart(entity) {
    return function (sprite, pointer) {
      runtime.drag = {
        entity: entity,
        sprite: sprite,
        pointer: pointer,
        entityStart: _.clone(entity.position),
        pointerStart: {x: pointer.x, y: pointer.y},
        spriteStart: {x: sprite.x, y: sprite.y}
      };
      if (entity.drag && entity.drag.start) {
        entity.drag.start(entity, sprite, pointer);
      }
    };
  }

  function updateEntityDrag(entity, sprite, pointer) {
    var dx = pointer.x - runtime.drag.pointerStart.x;
    var dy = pointer.y - runtime.drag.pointerStart.y;
    sprite.x = runtime.drag.spriteStart.x;
    sprite.y = runtime.drag.spriteStart.y;
    entity.position.x = runtime.drag.entityStart.x + dx;
    entity.position.y = runtime.drag.entityStart.y + dy;

    if (entity.drag.limit) {
      if (entity.drag.limit.relative) {
        if (entity.position.x < runtime.drag.entityStart.x - entity.drag.limit.relative.left) {
          entity.position.x = runtime.drag.entityStart.x - entity.drag.limit.relative.left;
        } else if (entity.position.x > runtime.drag.entityStart.x + entity.drag.limit.relative.right) {
          entity.position.x = runtime.drag.entityStart.x + entity.drag.limit.relative.right;
        }
        if (entity.position.y < runtime.drag.entityStart.y - entity.drag.limit.relative.up) {
          entity.position.y = runtime.drag.entityStart.y - entity.drag.limit.relative.up;
        } else if (entity.position.y > runtime.drag.entityStart.y + entity.drag.limit.relative.down) {
          entity.position.y = runtime.drag.entityStart.y + entity.drag.limit.relative.down;
        }
      }
      if (entity.drag.limit.absolute) {
        if (entity.position.x < entity.drag.limit.absolute.left) {
          entity.position.x = entity.drag.limit.absolute.left;
        } else if (entity.position.x > entity.drag.limit.absolute.right) {
          entity.position.x = entity.drag.limit.absolute.right;
        }
        if (entity.position.y < entity.drag.limit.absolute.up) {
          entity.position.y = entity.drag.limit.absolute.up;
        } else if (entity.position.y > entity.drag.limit.absolute.down) {
          entity.position.y = entity.drag.limit.absolute.down;
        }
      }
    }

    entity.update();
  }

  function dragEntityMove(entity, sprite, pointer) {
    if (entity.drag) {
      updateEntityDrag(entity, sprite, pointer);

      if (entity.drag.move) {
        entity.drag.move(entity, sprite, pointer);
      }
    }
  }

  function dragEntityStop(entity) {
    return function (sprite, pointer) {
      if (entity.drag) {
        updateEntityDrag(entity, sprite, pointer);

        if (entity.drag.stop) {
          entity.drag.stop(entity, sprite, pointer);
        }
      }
      delete runtime.drag;
    };
  }

  if (typeof (self.create == 'undefined')) {
    Engine.prototype.create = function () {
      phaser.input.keyboard.addKey(Phaser.Keyboard.D).onUp.add(function() {runtime.debug = !runtime.debug;});
      phaser.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
      phaser.scale.pageAlignHorizontally = true;
      phaser.scale.pageAlignVertically = true;
      phaser.scale.forceOrientation(true, false);
      phaser.scale.refresh();

      if (options.create) {
        options.create();
      }

      var bounds = runtime.components.bounds[0];
      phaser.world.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);

      // create group for each phaser object and hierarchy
      var groups = _.union(runtime.components.size, runtime.components.scale, runtime.components.position, runtime.components.image);
      groups.sort(function(a, b) {
        return a - b;
      });

      for (var i = 0; i < groups.length; ++i) {
        var id = groups[i];
        var entity = data.entities[id];
        var parent = self.findParentWithPhaser(entity) || {name: '<stage>'};
        var parentPhaser = runtime.phaser.objects[parent.id];
        if (options.log) {
          console.log('Creating phaser group for "' + entity.name + '", phaser parent "' + parent.name + '"');
        }
        var group = phaser.add.group(parentPhaser, entity.name);
        group.visible = false;
        runtime.phaser.objects[id] = group;
      }

      // create sprites for all entities with image component
      var images = _.map(runtime.components.image, function(key) {return key});
      images.sort(function(a, b) {
        return a - b;
      });
      images.reverse();

      for (var key in images) {
        var id = runtime.components.image[key];
        var entity = data.entities[id];
        var name = entity.image.name || entity.name;
        var imageName = name.replace(/#\d+/g, '');
        var group = runtime.phaser.objects[id];
        if (options.log) {
          console.log('Creating phaser sprite for "' + entity.name + '"');
        }
        var sprite = phaser.add.sprite(0, 0, imageName);
        group.add(sprite);
        sprite.name = entity.name;

        var interact = findInteract(entity);
        if (!interact && interact !== false) {
          interact = options.interact;
        }
        var drag = entity.drag;

        if (interact || drag) {
          sprite.inputEnabled = true;
          if (name.indexOf('background') == -1) {
            sprite.input.useHandCursor = true;
            sprite.input.pixelPerfectClick = true;
            sprite.input.pixelPerfectOver = true;
          }
          if (interact) {
            sprite.events.onInputDown.add(interact, entity);
          }

          if (drag) {
            sprite.input.enableDrag();
            sprite.input.setDragLock(false, false);
            if (drag.start) {
              sprite.events.onDragStart.add(dragEntityStart(entity));
            }
            if (drag.stop) {
              sprite.events.onDragStop.add(dragEntityStop(entity));
            }
          }
        }

        runtime.phaser.sprites[id] = sprite;
      }

      // create background rectangles for all entities with rectangle component
      var rectangles = _.map(runtime.components.rectangle, function(key) {return key});
      rectangles.sort(function(a, b) {
        return a - b;
      });
      rectangles.reverse();

      for (var key in rectangles) {
        var id = runtime.components.rectangle[key];
        var entity = data.entities[id];
        var name = entity.name;
        var sprite = runtime.phaser.sprites[id];
        var group = runtime.phaser.objects[id];
        if (options.log) {
          console.log('Creating background rectangle for "' + entity.name + '"');
        }
        var rectangle = entity.rectangle;
        var rect = phaser.add.graphics(0, 0);
        var opacity = entity.opacity ? entity.opacity : 1.0;
        rect.beginFill(rectangle.color, opacity * rectangle.opacity);
        var x = sprite.x - rectangle.padding;
        var y = sprite.y - rectangle.padding;
        var w = sprite.width + 2 * rectangle.padding;
        var h = sprite.height + 2 * rectangle.padding;
        if (rectangle.radius && rectangle.radius > 0) {
          rect.drawRoundedRect(x, y, w, h, rectangle.radius);
        } else {
          rect.drawRect(x, y, w, h);
        }
        rect.endFill();
        group.add(rect);
        group.sendToBack(rect);
        runtime.phaser.rectangles[id] = rect;
      }




      // create entity debug info
      for (var key in data.entities) {
        var entity = data.entities[key];
        var group = runtime.phaser.objects[entity.id];

        if (group) {
          var debug = phaser.add.group(group, entity.name + '/debug');
          var point = phaser.add.graphics(0, 0);
          //graphics.beginFill(0xFF00FF);
          //graphics.endFill();
          point.lineStyle(3, 0xFF00FF, 1);
          point.moveTo(-9, 0);
          point.lineTo(9, 0);
          point.moveTo(0, -9);
          point.lineTo(0, 9);
          debug.add(point);

          if (entity.path) {
            var path = phaser.add.graphics(0, 0);
            path.lineStyle(3, 0xFFFF00, 1);
            path.moveTo(entity.path[0][0], entity.path[0][1]);
            for (var i = 1; i < entity.path.length; ++i) {
              path.lineTo(entity.path[i][0], entity.path[i][1]);
            }
            debug.add(path);
          }

          var style = {font: '20px Arial', fill: '#FFFFFF', align: 'left'};
          var text = phaser.add.text(0, 0, entity.name, style);
          debug.add(text);

          debug.visible = false;
          group.debug = debug;
          group.add(debug);
        }
      }

      for (var key in data.entities) {
        var entity = data.entities[key];
        entity.update = self.makeUpdateEntity(entity);
        entity.update();
      }

      if (options.start) {
        options.start();
      }
    };
  }

  if (typeof (self.update == 'undefined')) {
    Engine.prototype.update = function () {
      if (runtime.drag) {
        dragEntityMove(runtime.drag.entity, runtime.drag.sprite, runtime.drag.pointer);
      }
    };
  }

  if (typeof (self.render == 'undefined')) {
    Engine.prototype.render = function() {
      if (options.render) {
        options.render();
      }
      if (runtime.debug) {
        phaser.debug.inputInfo(8, 16);
        for (var i in runtime.phaser.sprites) {
          var sprite = runtime.phaser.sprites[i];
          if (sprite.input && sprite.input.pointerOver(phaser.input.activePointer.id)) {
            phaser.debug.spriteBounds(sprite, 'rgba(0, 0, 0, 0.5)', true);
            phaser.debug.spriteInputInfo(sprite, sprite.getBounds().x + 8, sprite.getBounds().y + 16);
            phaser.debug.spriteInfo(sprite, 8, 116);
          } else {
            phaser.debug.body(sprite);
          }
        }
        for (var key in data.entities) {
          var entity = data.entities[key];
          var group = runtime.phaser.objects[entity.id];
          if (group && group.debug) {
            group.debug.visible= true;
          }
        }
      } else {
        for (var key in data.entities) {
          var entity = data.entities[key];
          var group = runtime.phaser.objects[entity.id];
          if (group && group.debug) {
            group.debug.visible = false;
          }
        }
      }
    };
  }

  if (typeof (self.activate == 'undefined')) {
    Engine.prototype.activate = function () {
      self.simulating = true;
      requestAnimationFrame(self.simulate);
    };
  }

  if (typeof (self.passivate == 'undefined')) {
    Engine.prototype.passivate = function () {
      self.simulating = false;
    };
  }
}
