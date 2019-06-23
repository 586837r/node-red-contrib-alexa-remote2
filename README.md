# node-red-contrib-alexa-remote2

![npm](https://img.shields.io/npm/v/node-red-contrib-alexa-remote2.svg) ![downloads](https://img.shields.io/npm/dt/node-red-contrib-alexa-remote2.svg)

This is a collection of node-red nodes for interacting with alexa.
All functionality is from [alexa-remote2](https://www.npmjs.com/package/alexa-remote2).
The goal is to expose all of [alexa-remote2](https://www.npmjs.com/package/alexa-remote2)s functionality in node-red nodes.

 - [Changelog](CHANGELOG.md)
 - [Examples](examples.md)

### **Authentification Method**
 - **Proxy** 
   - automatically captures your cookies using a proxy
   - enables cookie refreshing by sending a `msg.payload` of `refresh`
   - can setup persistant automatic initialisation with **File Path** and a refresh every few days
 - **Cookie**
   - login with manually entering your cookie
   - [How do i get my cookie?](get_cookie.md)
 - **Email & Password**
   - deprecated, use proxy
   - works with node version 10 but not with node version 8!
   - will not work if Captcha or 2 Factor Authentication is needed

### **Setup**
1. Drag a **Alexa Sequence** node into your flow.
2. Create a new Account by pressing the edit button at the right side of the *Account* field.
3. Choose a **Service Host** and **Page** and optionally **Language** depending on your location. For example:

   |     | Service Host        | Page         | Language |
   |-----|---------------------|--------------|----------|
   | USA | pitangui.amazon.com | amazon.com   | en-US    |
   | UK  | alexa.amazon.co.uk  | amazon.co.uk | en-UK    |
   | GER | layla.amazon.de     | amazon.de    | de-DE    |
   
4. Set **This IP** to the ip of your Node-RED server
5. Enter a **File Path** to save the authentication result so following authentications will be 
automatic (like `alexa-cookie.json` or `~/alexa/cookie.json`). 
6. *Add* the new Account.
7. Deploy
8. Follow the url you see in the node status
9.  Log in, wait until you see the node status **ready**
10. Select a device. Clicking on the button on the far right of the device field will let you select from a list of your devices.

Now trigger the Alexa Sequence Node with any message and your Alexa will say "Hello World!". (Hopefully!)