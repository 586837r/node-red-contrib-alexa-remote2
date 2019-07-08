const Base = require('alexa-remote2');
const util = require('util');

function requireUncached(mod) {
	delete require.cache[require.resolve(mod)];
	return require(mod);
}

// my own implementation to keep track of the value on errors, for debugging and patching false positives
function promisify(fun) {
	return (function() {
		return new Promise((resolve, reject) => {
			fun.bind(this)(...arguments, (err, val) => {
                if(err) {
                    if(typeof err === 'object') {
                        err.value = val;   
                    }
					reject(err);
                }
				else {
					resolve(val);
                }
			});
		});
	});
}

class AlexaRemote extends Base
{
	constructor() {
		super(arguments);

		// blacklist: ^(?:\t|[ ]{4})(?![A-z]*constructor)[A-z]*\((?![^\)]*callback)[^\)]*\)
		const names = [
			'getSmarthomeDevices', 
			'getSmarthomeEntities', 
			'getSmarthomeGroups',
			'getSmarthomeBehaviourActionDefinitions',
			'httpsGet'
		];
		
		for(const name of names) {
			this[name + 'Promise'] = promisify(this[name]);
		}
	}

	generateCookie(email, password, callback) {
        if (!this.alexaCookie) this.alexaCookie = requireUncached('alexa-cookie2');
        this.alexaCookie.generateAlexaCookie(email, password, this._options, callback);
    }

    refreshCookie(callback) {
        if (!this.alexaCookie) this.alexaCookie = requireUncached('alexa-cookie2');
        this.alexaCookie.refreshAlexaCookie(this._options, callback);
	}
}

module.exports = AlexaRemote;