const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteSetNode(input) {
		RED.nodes.createNode(this, input);
		let node = this;

		tools.assignTyped(node, ['target', 'serialOrName'], input);
		tools.assign(node, ['options'], input);
		tools.assignNode(RED, node, ['account'], input);

		node.on('close', function (removed, done) { this.status({}); done(); });
		node.on('input', function (msg) {
			let { target, serialOrName } = tools.assignTypedConvert(RED, node, msg, {}, ['target', 'serialOrName'], node);
			let options = tools.assignTypedStructConvert(RED, node, msg, {}, node.options[target]);

			let sendFun = (alexa) => {
				return new Promise((resolve, reject) => {
					let callback = (err, val) => err ? reject(err) : resolve(val); 

					switch (target) {
						case 'tuneIn': 			return alexa.setTunein(serialOrName, options.guideId, options.contentType, callback);
						case 'doNotDisturb':	return alexa.setDoNotDisturb(serialOrName, options.enabled, callback);
						case 'alarmVolume':		return alexa.setAlarmVolume(serialOrName, options.volume, callback);
						case 'list':			return alexa.setList(serialOrName, options.listType, options.value, callback);
						case 'reminder': 		return alexa.getList(serialOrName, options.timestamp, options.label, callback);
						default: return Promise.reject(new Error('invalid set target'));
					}
				})
			}

			tools.initAndSend(node, msg, sendFun);
		});
	}
	RED.nodes.registerType("alexa-remote-set", AlexaRemoteSetNode)
}