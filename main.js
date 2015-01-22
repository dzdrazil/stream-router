;(function(global) {
	'use strict';

	// externals
	var Kefir = global.Kefir;

	// internals
	function findOrCreate(key, object, alias, meta) {
		var returnSet;

		if (alias) {
			var fixedAlias = alias;
			if (object[fixedAlias]) returnSet = object[fixedAlias];
			else {
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
	}

	function matchRoutes(url, tree) {
		var parts = url.split('/');
		if (parts[0] === '') parts.shift();

		var bestMatch = -1;
		function match(node, parts, index, params, quality) {
			if (index === parts.length) return {node: node, params: params};

			var part = parts[index];
			var nextNode = node[part];

			if (nextNode) return match(nextNode, parts, index + 1, params, quality);
			if (!nextNode) {
				if (node[':var']) {
					nextNode = node[':var'];
					params.push(part);
					return match(nextNode, parts, index + 1, params, quality);
				}
				return {node: nextNode, params: params};
			}
		}

		var routeNode = match(tree, parts, 0, [], bestMatch);

		if (!routeNode || !routeNode.node) return;

		var params;
		if (routeNode.node.meta) {
			params = routeNode.node.meta.reduce(function(params, param, index) {
				params[param] = routeNode.params[index];
				return params;
			}, {});
		}


		return {stream: routeNode.node.stream, args: params};
	}

	// Prototype

	var proto = Object.create(HTMLElement.prototype);

	proto._routes = null;
	proto.currentRoute = null;

	proto._started = false;

	proto.onRoute = function(pattern) {
		var parts = pattern.split('/');
		if (parts[0] === '') parts.shift();

		var vars = [];

		var leaf = parts.reduce(function(set, part, index, list) {
			var alias;
			if (part.charAt(0) === ':')  {
				alias = ':var';
				vars.push(part.slice(1));
			}

			if (index === list.length -1) return findOrCreate(part, set, alias, vars);
			else return findOrCreate(part, set, alias);
		}.bind(this), this._routes);

		if (leaf.stream) return leaf.stream;
		else {
			var emitter = Kefir.emitter();
			leaf.stream = emitter;
			leaf.combinedStream = Kefir
				.sampledBy([emitter], [this.currentRoute])
				.map(function(args) {
					if (args[0] === args[1]) return args[0];
					return null;
				});
		}
		return leaf.combinedStream;
	};

	proto._onHashChange = function(e) {
		var newURL = e.newURL;
		var hash = newURL.split('#');

		if (hash.length < 1) return;

		hash.shift();
		var newPath = hash.join('#');
		var route = matchRoutes(newPath, this._routes);

		if (route && route.stream) {
			route.stream.emit(route.args);
			this.currentRoute.emit(route.args);
		} else {
			this.currentRoute.emit(null);
		}
	};

	proto.start = function() {
		if (this._started) return;

		this.started = true;
		this._onHashChange({newURL: global.location.hash});
	};

	// Lifecycle callbacks

	proto.createdCallback = function() {
		this._routes = {};
		this.currentRoute = Kefir.emitter();

		global.addEventListener('hashchange', this._onHashChange.bind(this));
	};

	proto.detachedCallback = function() {
		console.log('todo: cleanup');
	};

	global.document.registerElement('stream-router', {
		prototype: proto
	});

})(this);
