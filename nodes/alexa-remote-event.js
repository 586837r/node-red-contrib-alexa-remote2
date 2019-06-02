const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteEventNode(input) {
		RED.nodes.createNode(this, input);

		tools.assign(this, ['event'], input);
		tools.assignNode(RED, this, ['account'], input);

		this.on('close', function () { this.status({}); });
		this.onReady = function() {
			//node.warn('account init');
			this.status({ fill: "yellow", shape: "dot", text: "starting listening" });
			setTimeout(() => this.status({ fill: "grey", shape: "dot", text: "listening" }), 2000);

			this.account.alexa.addListener(this.event, val => {
				this.status({ fill: "green", shape: "dot", text: "event fired!" });
				setTimeout(() => this.status({ fill: "grey", shape: "dot", text: "listening" }), 2000);
				this.send({ payload: val });
			});
		};
		this.onStatus = (code, message) => {
			switch(code) {
				case 'init-proxy': 
				case 'init-cookie':
				case 'init-password':
				case 'wait-proxy': 		this.status({shape: 'ring', fill: 'grey', text: 'initialising' }); break;
				case 'refreshing': 		this.status({shape: 'ring', fill: 'grey', text: 'refreshing' }); break;
				case 'stopped':			this.status({shape: 'dot', fill: 'yellow', text: 'stopped'}); break;
				case 'ready': 			this.onReady(); break;
				case 'error':			this.status({shape: 'dot', fill: 'red', text: message}); break;
				default: 				this.status({shape: 'ring', fill: 'grey', text: 'uninitialized' }); break;
			}
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
	}
	RED.nodes.registerType("alexa-remote-event", AlexaRemoteEventNode)
}