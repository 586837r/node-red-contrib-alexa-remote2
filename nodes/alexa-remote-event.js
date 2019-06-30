const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteEventNode(input) {
		RED.nodes.createNode(this, input);

		tools.assign(this, ['event'], input);
		tools.assignNode(RED, this, ['account'], input);
		tools.nodeSetupForStatusReporting(this);

		this.onAlexaEvent = (val) => {
			this.status({ fill: "green", shape: "dot", text: "event fired!" });
			setTimeout(() => this.status({ fill: "grey", shape: "dot", text: "listening" }), 2000);
			this.send({ payload: val });
		}
		this.onStatus = (code) => {
			if(code !== 'ready') return;

			this.status({ fill: "yellow", shape: "dot", text: "starting listening" });
			setTimeout(() => this.status({ fill: "grey", shape: "dot", text: "listening" }), 2000);

			this.account.alexa.removeListener(this.event, this.onAlexaEvent);
			this.account.alexa.addListener(this.event, this.onAlexaEvent);
		}

		this.account.emitter.removeListener('status', this.onStatus);

		if(!this.account.useWsMqtt) {
			return this.status({ fill: "red", shape: "dot", text: "events not supported by account" });
		}
		else {
			this.account.emitter.addListener('status', this.onStatus);
			const {code, message} = this.account.status;
			this.onStatus(code, message);
		}

		this.on('close', function() {
			this.account.alexa.removeListener(this.event, this.onAlexaEvent);
		})
	}
	RED.nodes.registerType("alexa-remote-event", AlexaRemoteEventNode)
}