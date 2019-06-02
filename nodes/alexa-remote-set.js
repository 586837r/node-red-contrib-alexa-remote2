const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteSetNode(input) {
		RED.nodes.createNode(this, input);

		tools.assignTyped(this, ['target', 'serialOrName'], input);
		tools.assign(this, ['options'], input);
		tools.assignNode(RED, this, ['account'], input);

		this.on('close', function () { this.status({}); });
		this.on('input', function (msg) {
			const { target, serialOrName } = tools.assignTypedConvert(RED, this, msg, {}, ['target', 'serialOrName'], this);
			const options = tools.assignTypedStructConvert(RED, this, msg, {}, this.options[target]);

			this.status({ shape: 'dot', fill: 'grey', text: 'sending' });
			const alexa = this.account.alexa;
			const callback = (err, val) => tools.nodeErrVal(this, msg, err, val);

			console.log({device:serialOrName, target:target});

			switch (target) {
				case 'tuneIn': 			return alexa.setTunein(serialOrName, options.guideId, options.contentType, callback);
				case 'doNotDisturb':	return alexa.setDoNotDisturb(serialOrName, options.enabled, callback);
				case 'alarmVolume':		return alexa.setAlarmVolume(serialOrName, options.volume, callback);
				case 'list':			return alexa.setList(serialOrName, options.listType, options.value, callback);
				case 'reminder': 		return alexa.getList(serialOrName, options.timestamp, options.label, callback);
				default: 				return callback(new Error('Invalid set target'));
			}
		});
	}
	RED.nodes.registerType("alexa-remote-set", AlexaRemoteSetNode)
}