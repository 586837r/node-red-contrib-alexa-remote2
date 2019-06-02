const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteInitNode(input) {
		RED.nodes.createNode(this, input);

		tools.assignNode(RED, this, ['account'], input);
		this.autoInit = input.autoInit === 'on';

		this.stopBlinking = function() {
			if(this.blinkInterval) {
				clearInterval(this.blinkInterval);
				this.blinkInterval = null;
			}
			this.status({}); 
		}
		this.startBlinking = function(text) {
			this.blinkInterval = setInterval(() => {
				this.blinkState = !this.blinkState;
				const fill = this.blinkState ? 'blue' : 'grey';
				this.status({ shape: 'dot', fill: fill, text: text});
			}, 300);
		}
		this.onInput = function (msg) {
			if(!msg) msg = {}

			if(msg.payload === 'debug') {
				console.log(this);
				return;
			}

			if(msg.payload === 'stop') {
				this.account.stopAlexa();
				return;
			}

			if(msg.payload === 'refresh') {
				const callback = (err, val) => tools.nodeErrVal(this, msg, err, val);
				this.account.refreshAlexaCookie(callback);
				return;
			}

			this.account.initAlexa(msg.payload, (err) => {
				console.log(`CALLBACK: alexa-remote-init`, err);
				const options = this.account.alexa._options;
				const regData = options && options.formerRegistrationData;
				tools.nodeErrVal(this, msg, err, regData, 'ready');
			});
		}

		this.onStatus = (code, message) => {
			this.stopBlinking(); 

			switch(code) {
				case 'init-proxy': 		this.status({shape: 'dot', fill: 'grey', text: 'starting proxy' }); break;
				case 'init-cookie': 	this.status({shape: 'dot', fill: 'grey', text: 'init with cookie' }); break;
				case 'init-password': 	this.status({shape: 'dot', fill: 'grey', text: 'init with password' }); break;
				case 'refreshing': 		this.status({shape: 'dot', fill: 'blue', text: 'refreshing' }); break;
				case 'wait-proxy': 		this.startBlinking(message); break;
				case 'stopped':			this.status({shape: 'dot', fill: 'yellow', text: 'stopped'}); break;
				case 'ready': 			this.status({shape: 'dot', fill: 'green', text: 'ready'}); break;
				case 'error':			this.status({shape: 'dot', fill: 'red', text: message}); break;
				default: 				this.status({shape: 'ring', fill: 'grey', text: 'uninitialized' }); break;
			}
		}

		this.account.emitter.removeListener('status', this.onStatus);
		this.account.emitter.addListener('status', this.onStatus);

		// initial status update
		const {code, message} = this.account.status;
		this.onStatus(code, message);

		if(this.autoInit) {
			this.onInput({});
		}

		this.on('close', function () { 
			this.stopBlinking();
		});
		this.on('input', this.onInput);
	}
	RED.nodes.registerType("alexa-remote-init", AlexaRemoteInitNode)

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
}