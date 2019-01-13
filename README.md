# node-red-contrib-alexa-remote2

This is a collection of node-red nodes for interacting with alexa.
All functionality is from the great [alexa-remote2](https://www.npmjs.com/package/alexa-remote2).
The goal is to expose all of [alexa-remote2](https://www.npmjs.com/package/alexa-remote2)s functionality in node-red nodes.

 - [Changelog](CHANGELOG.md)
 - [Examples](examples.md)

### Logging in with Email and Password
   - **works with node version 10 but not with node version 8!**
   - will not work if Captcha or 2 Factor Authentication is needed

### Setup
1. Drag a **alexa remote sequence** node into your flow.
2. Create a new Account by pressing the edit button at the right side of the *Account* field.
3. Enter the **Cookie** or the **Email** and **Password** of your Amazon Alexa Account.
   - [How do i get my cookie?](get_cookie.md)
   - [Logging in with Email and Password](#logging-in-with-email-and-password)
4. Choose a **Service Host** and **Page** depending on your location. For example:

   ||Service Host|Page
   |---|---|---
   |USA|pitangui.amazon.com|amazon.com
   |UK|alexa.amazon.co.uk|amazon.co.uk
   |GER|layla.amazon.de|amazon.de
   
5. *Add* the new Account.
6. Enter the **Device** name (or Serial Number) of the target Alexa Device that is connected to your account.

Now trigger the Alexa Sequence Node with any message and your Alexa will say "Hello World!". (Hopefully!)

### Advanced
- **alexa remote sequence**: you can set the sequence by message too, see node info
- you can override the account for each node by defining `msg.alexaRemoteAccount` with the required properties: `cookie` or `email` and `password`, `alexaServiceHost`, `amazonPage`, and optional properties: `bluetooth`*(true/false)*, `useWsMqtt`*(=events true/false)*, `acceptLanguage` and `userAgent`.