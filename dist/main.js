"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _get = function get(object, property, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    return desc.value;
  } else {
    var getter = desc.get;
    if (getter === undefined) {
      return undefined;
    }
    return getter.call(receiver);
  }
};

var _inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) subClass.__proto__ = superClass;
};

;(function (global) {
  "use strict";

  //
  // Helper methods
  //

  /**
   * Find or create a key in an object. Optionally tests for an alias,
   * and assigns the metadata property if it exists.
   *
   * Handy for creating a route tree while reducing a list of route parts
   *
   * @param  {String} key    Key to search for
   * @param  {Object} object Hash / tree to search
   * @param  {String} alias  Alias they key might be under (useful for matching parameters in a route tree)
   * @param  {Any} meta   Associated metadata
   * @return {Object}        Returns the leaf node
   */
  var findOrCreate = function (key, object, alias, meta) {
    var returnSet;

    if (alias) {
      var fixedAlias = alias;
      if (object[fixedAlias]) returnSet = object[fixedAlias];else {
        returnSet = object[fixedAlias] = {};
      }
    } else if (!object[key]) {
      object[key] = {};
      returnSet = object[key];
    } else {
      returnSet = object[key];
    }

    if (meta) returnSet.meta = meta;

    return returnSet;
  };

  /**
   * Splits a `/` delimited path and walks the given hash tree, returning
   * an object with the matched route node (if found) as well as the accumulated
   * parameters
   *
   * @param  {String} url  A `/` delimited path
   * @param  {Object} tree An object representing a route tree, where keys are parts and values are child routes
   * @return {Object}      Returns an object in the form {stream, args}
   */
  var matchRoutes = function (url, tree) {
    var match = function (node, parts, index, params, quality) {
      if (index === parts.length) return { node: node, params: params };

      var part = parts[index];
      var nextNode = node[part];

      if (nextNode) return match(nextNode, parts, index + 1, params, quality);
      if (!nextNode) {
        if (node[":var"]) {
          nextNode = node[":var"];
          params.push(part);
          return match(nextNode, parts, index + 1, params, quality);
        }
        return { node: nextNode, params: params };
      }
    };

    var parts = url.split("/");
    if (parts[0] === "") parts.shift();

    var bestMatch = -1;


    var routeNode = match(tree, parts, 0, [], bestMatch);

    if (!routeNode || !routeNode.node) return;

    var params;
    if (routeNode.node.meta) {
      params = routeNode.node.meta.reduce(function (params, param, index) {
        params[param] = routeNode.params[index];
        return params;
      }, {});
    }


    return { stream: routeNode.node.stream, args: params };
  };

  //
  // External Dependencies
  //
  var Kefir = global.Kefir;

  /**
   * @class StreamRouter
   */
  var StreamRouter = (function (HTMLElement) {
    /**
     * @constructor
     */
    function StreamRouter() {
      this._routes = {};
      this.currentRoute = Kefir.emitter();
      this._started = false;

      _get(Object.getPrototypeOf(StreamRouter.prototype), "constructor", this).apply(this, arguments);
    }

    _inherits(StreamRouter, HTMLElement);

    _prototypeProperties(StreamRouter, null, {
      start: {

        /**
         * Initialize the router, effectively imitating a hash change event
         *
         * Has no effect when called consecutive times.
         */
        value: function start() {
          if (this._started) return;

          this.started = true;
          this._onHashChange({ newURL: global.location.hash });
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      onRoute: {

        /**
         * Returns a Kefir stream that emits on every hash change.
         * If the hash change does not match the pattern, null is emitted. Otherwise, a hash
         * representing values from the URL is emitted.
         *
         * @param  {String} pattern Pattern to emit
         * @return {Kefir.Emitter}
         */
        value: function onRoute(pattern) {
          var parts = pattern.split("/");
          if (parts[0] === "") parts.shift();

          var vars = [];

          var leaf = parts.reduce(function (set, part, index, list) {
            var alias;
            if (part.charAt(0) === ":") {
              alias = ":var";
              vars.push(part.slice(1));
            }

            if (index === list.length - 1) return findOrCreate(part, set, alias, vars);else return findOrCreate(part, set, alias);
          }, this._routes);

          if (leaf.stream) return leaf.stream;else {
            var emitter = Kefir.emitter();
            leaf.stream = emitter;
            leaf.combinedStream = Kefir.sampledBy([emitter], [this.currentRoute]).map(function (args) {
              if (args[0] === args[1]) return args[0];
              return null;
            });
          }
          return leaf.combinedStream;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      _onHashChange: {

        /**
         * @private
         * @param  {DOMEvent} e Hash change event
         */
        value: function OnHashChange(e) {
          var newURL = e.newURL;
          var hash = newURL.split("#");

          if (hash.length < 1) return;

          hash.shift();
          var newPath = hash.join("#");
          var route = matchRoutes(newPath, this._routes);

          if (route && route.stream) {
            route.stream.emit(route.args);
            this.currentRoute.emit(route.args);
          } else {
            this.currentRoute.emit(null);
          }
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      createdCallback: {

        // LIFECYCLE CALLBACKS
        value: function createdCallback() {
          this._routes = {};
          this.currentRoute = Kefir.emitter();

          global.addEventListener("hashchange", this._onHashChange.bind(this));
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      detachedCallback: {
        value: function detachedCallback() {
          console.warn("todo: cleanup");
        },
        writable: true,
        enumerable: true,
        configurable: true
      }
    });

    return StreamRouter;
  })(HTMLElement);

  global.document.registerElement("stream-router", {
    prototype: StreamRouter.prototype
  });
})(this);
