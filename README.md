# node-red-contrib-alexa-remote2

This is a collection of node-red nodes for interacting with alexa.
All functionality is from [alexa-remote2](https://www.npmjs.com/package/alexa-remote2).
The goal is to expose all of [alexa-remote2](https://www.npmjs.com/package/alexa-remote2)s functionality in node-red nodes.

 - [Changelog](CHANGELOG.md)
 - [Examples](examples.md)

### Logging in with Proxy
   - highly recommended
   - you will have to log in to amazon using the proxy, cookies will be automatically captured
   - cookie refresh is possible by sending a `msg.payload` of `"refresh"`
   - can setup a persistant automatic initialisation with **File Path**, and aforementioned refresh with an inject node

### Logging in with Cookie
   - [How do i get my cookie?](get_cookie.md)

### Logging in with Email and Password
   - deprecated, use proxy
   - **works with node version 10 but not with node version 8!**
   - will not work if Captcha or 2 Factor Authentication is needed


### Setup
1. Drag a **Alexa Sequence** node into your flow.
2. Create a new Account by pressing the edit button at the right side of the *Account* field.
3. Choose a **Service Host** and **Page** and optionally **Language** depending on your location. For example:

   ||Service Host|Page|Language
   |---|---|---|---
   |USA|pitangui.amazon.com|amazon.com|en-US
   |UK|alexa.amazon.co.uk|amazon.co.uk|en-UK
   |GER|layla.amazon.de|amazon.de|de-DE
   
4. **recommended:** Enter a file path to save the authentication result so following authentications will be automatic. 
5. *Add* the new Account.
6. Deploy
7. Follow the url you see in the node status, by default `localhost:3456` but replace localhost with the ip of your nodered server.
8. Log in, wait until you see the node status **ready**
9. Select a device. Clicking on the button on the far right of the device field will let you select from a list of your devices.

Now trigger the Alexa Sequence Node with any message and your Alexa will say "Hello World!". (Hopefully!)

### Automatic Initialisation (proxy)
 - Enter a file path to save the authentication result.
 - To keep authentication working you should refresh the cookie every few days. 
Simply attach an inject node with the payload `"refresh"` to do so.