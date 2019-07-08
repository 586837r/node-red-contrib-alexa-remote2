const DEBUG_THIS = true;
const DEBUG_ALEXA_REMOTE2 = false;
const util = require('util');

function log(what, depth=10, width=80) {
	console.log(util.inspect(what, {
		depth: depth,
		colors: true,
		breakLength: width
	}));
}

function sortObject(o, compareFunction) {
    if(!compareFunction) {
        return Object.keys(o).sort().reduce((r, k) => (r[k] = o[k], r), {});
    }

    return Object.entries(o).sort(compareFunction).reduce((r, k) => (r[k] = o[k], r), {});
}

function error(message, value) {
	const error = new Error(message);
	error.value = value;
	return error;
}

// stop to stop after a find -> no further recursion
// object to recurse objects, array to recurse arrays
function findRecursive(any, pred, args = { stop: true, object: true, array: true}) {
	let array = [];
	if (pred(any)) {
		array.push(any);
		if (args.stop) return array;
	}

	if (Array.isArray(any)) {
		if (args.array) for (e of any) {
			array = array.concat(findRecursive(e, pred, args));
		}
	}
	else if (args.object && typeof any === 'object' && any !== null) {
        for(const v of Object.values(any)) {
            array = array.concat(findRecursive(v, pred, args));
        }
	}
	return array;
}

function alnumEqual(a,b) {
	[a,b] = [a,b].map(s => s.replace(/[^a-z0-9]/ig, '').toLowerCase());
	return a === b;
}

module.exports = {
	DEBUG_THIS: DEBUG_THIS,
	DEBUG_ALEXA_REMOTE2: DEBUG_ALEXA_REMOTE2,
	log: log,
	alnumEqual: alnumEqual,
	sortObject: sortObject,
	findRecursive: findRecursive,
	error: error,
	isObject: function (x) {
		return typeof x == 'object' && x !== null && !Array.isArray(x) 
	},
	clone: function(x, recurseObj = true, recurseArray = true) {
		if (typeof x !== 'object' || x === null)
			return x;
	
		if (Array.isArray(x)) {
			if (!recurseArray)
				return x.slice();
	
			const result = new Array(x.length);
			for (let i = 0; i < x.length; i++) {
				result[i] = this.clone(x[i], recurseObj, recurseArray);
			}
			return result;
		}
		else /* is object */ {
			if (!recurseObj)
			return x;
			
			const result = {};
			for (const k of Object.keys(x)) {
				result[k] = this.clone(x[k], recurseObj, recurseArray);
			}
			return result;
		}
	},
	
	// clones template object and applies source object properties if they are of the same type
	template: function(templ, source, recurseObj = true, recurseArray = true) {
		// are they different types?
		if(typeof templ !== typeof source || Array.isArray(templ) !== Array.isArray(source) || this.isObject(templ) !== this.isObject(source)) {
			return this.clone(templ, recurseObj, recurseArray);
		}
	
		if(Array.isArray(templ) && recurseArray) {
			const result = new Array(templ.length);
			for (let i = 0; i < templ.length; i++) {
				result[i] = this.template(templ[i], source[i], recurseObj, recurseArray);
			}
			return result;
		}
	
		if(this.isObject(templ) && recurseObj) {
			const result = {};
			for (const k of Object.keys(templ)) {
				result[k] = this.template(templ[k], source[k], recurseObj, recurseArray);
			}
			return result;
		}
	
		return source;
	},
	
	// checks if the types match, recursively
	matches: function(source, templ, recurseObj = true) {

		if(templ === undefined) {
			return true;
		}

		// are they different types?
		if(typeof templ !== typeof source || Array.isArray(templ) !== Array.isArray(source) || this.isObject(templ) !== this.isObject(source)) {
			return false;
		}
	
		if(Array.isArray(templ)) {
			if(templ.length === 0) {
				return true;
			}
			for (let i = 0; i < source.length; i++) {
				if(!this.matches(source[i], templ[0], recurseObj)) {
					return false;
				}
			}
			return true;
		}
	
		if(this.isObject(templ) && recurseObj) {
			for (const k of Object.keys(templ)) {
				if(!source.hasOwnProperty(k)) {
					return false;
				}

				if(!this.matches(source[k], templ[k], recurseObj)) {
					return false;
				}
			}
			return true;
		}
	
		return true;
	},
	trim: function(str, len) {
		return str.length > len ? str.substring(0, len - 3) + "..." : str.substring(0, len)
	},
	flatten: function(arr) {
		return arr.reduce(function (flat, toFlatten) {
			return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
		}, []);
	},
	tryParseJson: function(json) {
		let obj = null
		
		try {
			obj = JSON.parse(json);
			if (!obj || typeof obj !== "object") throw "not json";
		}
		catch (ex) {
			//console.log(ex);
		}
		return obj;
	},
	camelCaseToLabel: function(str) {
		str = String(str);
		return str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
	},
	createFormRow: function(label='', icon='') {
		const $row = $('<div>').addClass('form-row');
		const $container = $('<div>').attr('style', 'display: inline-block; position: relative; width: 70%; height: 20px;');
		const $icon = $('<i>').attr('class', icon);
		const $label = $('<label>').text(' ' + label);
		const $space = $(document.createTextNode(' '));

		$row.append(
			$label.prepend(
				$icon
			),
			$space,
			$container
		);

		return [$row, $container];
	},
	mapObject: function(obj, fun) {
		return Object.keys(obj).reduce((res, key) => {
			res[key] = fun(obj[key]);
			return res;
		}, {});
	},
	filterObject: function(obj, predicate) {
		return Object.keys(obj).reduce((res, key) => {
			if(predicate(obj[key])) {
				res[key] = obj[key];
			}
			return res;
		}, {});
	},
	// assign properties of source objects to a destination object
	// example: 
	// let source_a = { foo: 1, bar: 2, unrelated_a: 'hihi' };
	// let source_b = { bar: 'ignored', baz: 3, unrelated_b: 'hihi'};
	// let dest = {};
	// assign(dest, ['foo', 'bar', 'baz'], source_a, source_b)
	// -> { foo: 1, bar: 2, baz: 3 }
	assignBase: function (callback, dest, keys) {
		// console.log({assignBase: arguments});

		if (Array.isArray(keys)) {
			let sources = [...arguments].slice(3);
			for (key of keys) {
				for (source of sources) {
					callback(dest, source, key);
				}
			}
		}
		else {
			// keys are omitted -> all keys are copied
			let sources = [...arguments].slice(2);
			sources.reverse();
			for(source of sources) {
				Object.keys(source).forEach(key => {
					callback(dest, source, key);
				})
			}
		}
		return dest;
	},
	assignMap: function(callback, dest, keys) {
		return this.assignBase(
			(dst, src, key) => {
				if(src[key] === undefined)
					return;
				
				dst[key] = callback(src[key]);
			},
			...[...arguments].slice(1)
		);
	},
	assign: 						function (dest, props) 					{ return this.assignMap(x => x, ...arguments) },
	assignNode:						function (RED, dest, props) 			{ return this.assignMap(x => RED.nodes.getNode(x), ...[...arguments].slice(1)) },
	assignTypedStructConvert: 		function (RED, node, msg, dest, props) 	{ return this.assignMap(x => RED.util.evaluateNodeProperty(x.value, x.type, node, msg), ...[...arguments].slice(3)) },
	assignTyped: function(dest, props) {
		return this.assignBase(
			(dst, src, key) => {
				let val_key = `${key}_value`;
				let typ_key = `${key}_type`;

				let val = src[val_key];
				let typ = src[typ_key];

				dst[val_key] = val;
				dst[typ_key] = typ;
			},
			...arguments
		);
	},
	assignTypedConvert: function (RED, node, msg, dest, props) { 
		return this.assignBase(
			(dst, src, key) => { 
				let val = src[`${key}_value`];
				let typ = src[`${key}_type`];

				if (val === undefined || typ === undefined)
					return false;

				dst[key] = RED.util.evaluateNodeProperty(val, typ, node, msg);
				return true;
			}, 
			...[...arguments].slice(3)
		);
	},
	nodeErrVal: function(node, msg, err, val, text = '') {
		// filter out "no body" because it is a false positive
		if(!err || err.message === 'no body') {
			msg.payload = val;
			node.status({ shape: 'dot', fill: 'green', text: text || 'success' });
			node.send(msg);
		}
		else {
			// our own way to send warnings over err,val
			if(err.warning) {
				node.status({ shape: 'dot', fill: 'yellow', text: text || this.trim(err.message, 32) });
				node.warn(err);
			}
			else {
				msg.payload = val;
				node.status({ shape: 'dot', fill: 'red', text: text || this.trim(err.message, 32) });
				node.error(err, msg);
			}
		}
	},
	// does this: 
	// squishArray([1,2,3,4,5], 3) -> [1,2,[3,4,5]]
	squishArray: function(array, length) {
		const result = array.slice(0, length);
		const last = array.slice(length-1);
		result[length-1] = last;
		return result;
	},
	nodeErrValArray: function(node, msg, errvals = [], outputs){
		let counter = 0;
		const msgs = new Array(outputs);

		if (errvals.length <= outputs) {
			for (let i = 0; i < outputs; i++) {
				const [err, val] = errvals[i];
				const newmsg = Object.assign({}, msg, { payload: val });

				if (err) {
					node.error(err, newmsg);
				}
				else {
					msgs[i] = newmsg;
					counter++;
				}
			}
		}
		else {
			let i = 0;
			for (; i < outputs-1; i++) {
				const [err, val] = errvals[i];
				const newmsg = Object.assign({}, msg, { payload: val });

				if (err) {
					node.error(err, newmsg);
				}
				else {
					msgs[i] = newmsg;
					counter++;
				}
			}

			const lastmsg = msgs[outputs-1] = Object.assign({}, msg, {payload: []});

			for (; i < errvals.length; i++) {
				const [err, val] = errvals[i];
				
				if (err) {
					const newmsg = Object.assign({}, msg, { payload: val });
					node.error(err, newmsg);
				}
				else {
					lastmsg.push(val);
					counter++;
				}
			}
		}

		if(counter === errvals.length) {
			node.status({ shape: 'dot', fill: 'green', text: `${counter} / ${errvals.length}` });
		}
		else {
			node.status({ shape: 'dot', fill: 'red', text: `${counter} / ${errvals.length}` });
		}

		node.send(msgs);
	},
	nodeErrMsgArray: function(node, msg, errmsgs = [], outputs) {
		let counter = 0;
		const msgs = new Array(outputs);

		if (errvals.length <= outputs) {
			for (let i = 0; i < outputs; i++) {
				let [err, newmsg] = errmsgs[i];
				newmsg = Object.assign({}, msg, newmsg);

				if (err) {
					node.error(err, newmsg);
				}
				else {
					msgs[i] = newmsg;
					counter++;
				}
			}
		}
		else {
			let i = 0;
			for (; i < outputs-1; i++) {
				let [err, newmsg] = errmsgs[i];
				newmsg = Object.assign({}, msg, newmsg);

				if (err) {
					node.error(err, newmsg);
				}
				else {
					msgs[i] = newmsg;
					counter++;
				}
			}

			const lastmsg = msgs[outputs-1] = Object.assign({}, msg, {payload: []});

			for (; i < errvals.length; i++) {
				const [err, val] = errvals[i];
				
				if (err) {
					const newmsg = Object.assign({}, msg, { payload: val });
					node.error(err, newmsg);
				}
				else {
					lastmsg.push(val);
					counter++;
				}
			}
		}

		if(counter === errvals.length) {
			node.status({ shape: 'dot', fill: 'green', text: `${counter} / ${errvals.length}` });
		}
		else {
			node.status({ shape: 'dot', fill: 'red', text: `${counter} / ${errvals.length}` });
		}

		node.send(msgs);
	},
	executeAutomationRoutine(alexa, serialOrName, utteranceOrId, callback) {
		if (typeof utteranceOrId !== 'string') {
			return callback && callback(new Error('utteranceOrId needs to be a string'));
		}

		alexa.getAutomationRoutines((err, res) => {
			if (err) {
				return callback && callback(err, res);
			}

			let routines = res;
			let routine;

			if (utteranceOrId.match(/amzn1.alexa.automation/)) {
				// is id
				routine = routines.find(r => r.automationId === utteranceOrId);
			}
			else {
				// is utterance
				routine = routines.find(
					routine => routine.triggers.find(
						trigger => trigger.payload.utterance === utteranceOrId));
			}

			if (!routine) {
				return callback && callback(new Error('Routine not found'));
			}

			let command = {
				sequence: routine.sequence,
				automationId: routine.automationId,
				status: 'ENABLED',
			};

			alexa.sendSequenceCommand(serialOrName, command, callback);
		});
	},
	/* provide a simpler interface to the internal one, based on alexa-remote2 createSequenceNode
		
	 */
	convertSequenceNode(node) {

	},
	sendSequenceNode(alexa, node) {

	},
	nodeSetupForStatusReporting: function(node) {
		
		if(!node.account) {
			node.status({shape: 'dot', fill: 'red', text: 'Account missing!'});
			return false;
		}

		node.blinkState = false;

		node._stopBlinking = function() {
			if(this.blinkInterval) {
				clearInterval(this.blinkInterval);
				this.blinkInterval = null;
			}
			this.status({}); 
		}
		node._startBlinking = function(a, b) {
			this.blinkInterval = setInterval(() => {
				this.blinkState = !this.blinkState;
				this.status(this.blinkState ? a : b);
			}, 300);
		}

		node._onStatus = (code, message) => {
			node._stopBlinking(); 
			const text = typeof message === 'string' ? (message.includes(' in your browser') ? message : this.trim(message, 32)) : '';

			switch(code) {
				case 'init-proxy': 		node.status({shape: 'dot', fill: 'grey', text: 'init with proxy' }); break;
				case 'init-cookie': 	node.status({shape: 'dot', fill: 'grey', text: 'init with cookie' }); break;
				case 'init-password': 	node.status({shape: 'dot', fill: 'grey', text: 'init with password' }); break;
				case 'refreshing': 		node.status({shape: 'dot', fill: 'blue', text: 'refreshing' }); break;
				case 'wait-proxy': 		node._startBlinking(
					{ shape: 'dot', fill: 'blue', text: text }, 
					{ shape: 'dot', fill: 'grey', text: text }); break;
				case 'stopped':			node.status({shape: 'dot', fill: 'yellow', text: 'stopped'}); break;
				case 'ready': 			node.status({shape: 'dot', fill: 'green', text: 'ready'}); break;
				case 'error':			node.status({shape: 'dot', fill: 'red', text: message}); break;
				default: 				node.status({shape: 'ring', fill: 'grey', text: 'uninitialized' }); break;
			}
		}

		node.account.emitter.removeListener('status', node._onStatus);
		node.account.emitter.addListener('status', node._onStatus);

		// initial status update
		const {code, message} = node.account.status;
		node._onStatus(code, message);

		node.addListener('close', function () { 
			node.account.emitter.removeListener('status', node._onStatus);
			this._stopBlinking();
		});

		return true;
	},
	querySmarthomeDevices(alexa, stateRequests, callback) {
		/*
		'stateRequests': [
			{
				'entityId': 'AAA_SonarCloudService_00:17:88:01:04:1D:4C:A0',
				'entityType': 'APPLIANCE'
			}
		]
		*/

		const flags = {
			method: 'POST',
			data: JSON.stringify({
				'stateRequests': stateRequests
			})
		}

		console.log(util.inspect(flags, false, 10, true));
		alexa.httpsGet ('/api/phoenix/state', callback, flags);
	},
	executeSmarthomeDeviceAction(alexa, controlRequests, callback) {
		/*
        {
            'controlRequests': [
                {
                    'entityId': 'bbd72582-4b16-4d1f-ab1b-28a9826b6799',
                    'entityType':'APPLIANCE',
                    'parameters':{
                        'action':'turnOn'
                    }
                }
            ]
		}
		*/

		const flags = {
			method: 'PUT',
			data: JSON.stringify({
				'controlRequests': controlRequests
			})
		}

		console.log(util.inspect(flags, false, 10, true));
		alexa.httpsGet ('/api/phoenix/state', callback, flags);
	},
	requestSmarthome(alexa, requests, callback) {
		/*
        {
			'stateRequests': [
				{
					'entityId': 'AAA_SonarCloudService_00:17:88:01:04:1D:4C:A0',
					'entityType': 'APPLIANCE'
				}
			]
            'controlRequests': [
                {
                    'entityId': 'bbd72582-4b16-4d1f-ab1b-28a9826b6799',
                    'entityType':'APPLIANCE',
                    'parameters':{
                        'action':'turnOn'
                    }
                }
            ]
		}
		*/

		const flags = {
			method: 'PUT',
			data: JSON.stringify(requests)
		}

		console.log(util.inspect(flags, false, 10, true));
		alexa.httpsGet ('/api/phoenix/state', callback, flags);
	}
};