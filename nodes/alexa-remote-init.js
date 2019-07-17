const tools = require('../lib/common.js');
const util = require('util');

module.exports = function (RED) {
	function AlexaRemoteInitNode(input) {
		RED.nodes.createNode(this, input);
		tools.assignNode(RED, this, ['account'], input);
		if(!tools.nodeSetup(this, input, true)) return;

		this.on('input', function (msg) {
			const send = tools.nodeGetSendCb(this, msg);
			const error = tools.nodeGetErrorCb(this);

			if(msg.payload === 'debug') {
				return send(tools.stringifyOmitCircular(this.account));
			}

			if(msg.payload === 'stop' || msg.payload === 'reset') {
				this.account.resetAlexa();
				return send();
			}

			if(msg.payload === 'refresh') {
				this.account.refreshAlexa();
				return send();
			}

			return this.account.initAlexa(msg.payload).then(tools.nodeGetSendCb(this, msg)).catch(tools.nodeGetErrorCb(this));
		});
	}

	RED.nodes.registerType("alexa-remote-init", AlexaRemoteInitNode);

	/*
	RED.httpAdmin.post("/alexa-remote-init/:id", RED.auth.needsPermission("config.write"), function(req, res){
		const node = RED.nodes.getNode(req.params.id);
        if (node != null) {
            try {
				const msg = {}
				const proxyRunning = node.account.status.code === 'wait-proxy';
				if(proxyRunning) {
					msg.payload = 'stop';
				}
				node.onInput(msg);
                res.sendStatus(200);
            } catch(err) {
                res.sendStatus(500);
                node.error(err);
            }
        } else {
            res.sendStatus(404);
        }
	})
	*/
}