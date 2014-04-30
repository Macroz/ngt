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

    var camera = self.camera = {};

    if (options.log) {
        console.log('Indexing entities by ' + Object.keys(runtime.index).join(', '));
    }

    runtime.components = {};
    runtime.components.image = [];
    runtime.components.position = [];
    runtime.components.scale = [];
    runtime.components.size = [];
    runtime.components.bounds = [];

    if (options.log) {
        console.log('Storing components by ' + Object.keys(runtime.components).join(', '));
    }
    runtime.phaser = {};
    runtime.phaser.sprites = {};
    runtime.phaser.objects = {};

    var phaser;

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

    if (typeof (self.cameraAt == 'undefined')) {
        Engine.prototype.cameraAt = function(path) {
            self.camera.path = path;
            self.camera.needsUpdate = true;
        };
    }

    if (typeof (self.updateVisibility == 'undefined')) {
        Engine.prototype.updateVisibility = function () {
            var path = self.camera.path;
            var root = self.camera.root;
            self.camera.needsUpdate = false;
            for (var key in data.entities) {
                var entity = data.entities[key];
                var name = entity.name;
                var group = runtime.phaser.objects[entity.id];
                if (group && name.startsWith(root)) {
                    if (name.startsWith(path)) {
                        group.visible = true;
                    } else {
                        group.visible = false;
                    }
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
                var defaultSrc = ('images/' + entity.name.replace(/\//g, '_')).replace(/#\d+/g, '');
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

    if (typeof (self.create == 'undefined')) {
        Engine.prototype.create = function () {
            phaser.input.keyboard.addKey(Phaser.Keyboard.D).onUp.add(function() {runtime.debug = !runtime.debug;});
            phaser.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
            phaser.scale.setShowAll();
            phaser.scale.pageAlignHorizontally = true;
            phaser.scale.pageAlignVertically = true;
            phaser.scale.refresh();

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
                group.visible = entity.visible;
                var position = entity.position;
                if (position) {
                    group.x = position.x;
                    group.y = position.y;
                }
                var rotation = entity.rotation;
                if (rotation) {
                    group.angle = rotation.angle;
                }
                var size = entity.size;
                if (size) {
                    group.width = size.width || options.screen.width;
                    group.height = size.height || options.screen.height;
                }
                runtime.phaser.objects[id] = group;
            }

            var bounds = runtime.components.bounds[0];
            phaser.world.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);

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
                var opacity = 1.0 - (entity.opacity || 0);
                sprite.name = entity.name;
                sprite.alpha = opacity;

                sprite.inputEnabled = true;
                if (name.indexOf('background') == -1) {
                    sprite.input.useHandCursor = true;
                    sprite.input.pixelPerfectClick = true;
                    sprite.input.pixelPerfectOver = true;
                }
                sprite.events.onInputDown.add(options.interact, this);

                if (entity.size) {
                    sprite.width = entity.size.width;
                    sprite.height = entity.size.height;
                }
                if (entity.image.flip) {
                    sprite.scale.x = -1;
                }
                runtime.phaser.sprites[id] = sprite;
            }

            if (options.create) {
                options.create();
            }
        };
    }

    if (typeof (self.update == 'undefined')) {
        Engine.prototype.update = function () {
        };
    }

    if (typeof (self.render == 'undefined')) {
        Engine.prototype.render = function() {
            if (camera.needsUpdate) {
                self.updateVisibility();
            }
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
