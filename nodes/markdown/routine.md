Emulates Alexa Routine behaviour.

---

### **Info**

- Echo devices can be referenced by id or name (not case sensitive)
- Announcement and SSML speak options will speak to all devices if you don't specify any device (does not work with *Speak At Volume*)
- **Speak At Volume** only works if the echo has recently been playing music!

- With the **Custom** option, you can feed in a routine node as js object for completely dynamic routines. The objects can look like this:
  - ```{ type: 'speak', payload: { type: 'regular', text: 'Hello!', devices: ['My Echo']}```
  - ```{ type: 'speakAtVolume', payload: { type: 'regular', text: 'Hello!', volume: 50 devices: ['My Echo']}```
    - type: `regular`, `ssml`, `announcement` 
    - devices: string or array, can be falsy to send to all devices (only for type speak with announcement or ssml type)
  - ```{ type: 'stop', payload: { devices: ['My Echo']}```
  - ```{ type: 'stop', payload: { devices: ['My Echo']}```
  - ```{ type: 'prompt', payload: { type: 'goodMorning', devices: ['My Echo']}```
    - prompt: `goodMorning`, `weather`, `traffic`, `flashBriefing`, `singSong`, `joke`, `tellStory`, `calendarToday`, `calendarTomorrow`, `calendarNext`
  - ```{ type: 'volume', payload: { value: 50, devices: ['My Echo']}```
    - value 0..100
  - ```{ type: 'music', payload: { provider: 'AMAZON_MUSIC', search: '', device: 'My Echo', duration: 300}```
    - provider: `AMAZON_MUSIC`, `TUNEIN`, `CLOUDPLAYER`, `SPOTIFY`
    - duration is optional
  - ```{ type: 'wait', payload: { time: 3 }``` 
    - time in seconds 
  - ```{ type: 'smarthome', payload: { entity: 'Lamp', action: 'setColor', value: '#FF00FF' }``` *(seconds)*
    - entity can be an id or name (case insensitive) 
    - action: `turnOn`, `turnOff`, `setColor`, `setColorTemperature`, `setBrightness`, `setPercentage`, `lockAction`, `setTargetTemperature`
  - ```{ type: 'routine', payload: { routine: 'hello' }```
    - routine can be an id or utterance (case insensitive)
  - ```{ type: 'pushNotification', payload: { text: 'Hello from Node-RED!' }```  
  - ```{ type: 'node', payload: { type: 'serial', children: [ { type: 'speak', payload: {...}}] }```  
    - type: `serial`, `parallel`

---

### **References**
 - [npm](https://npmjs.com/package/node-red-contrib-alexa-remote2) - the nodes npm repository
 - [GitHub](https://github.com/586837r/node-red-contrib-alexa-remote2) - the nodes GitHub repository