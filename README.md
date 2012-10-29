wms-engineer-client
==================

Simple web client for engineers to integrate with workforce management systems in enterprises.

Requires an installation of Node 0.8.x.

## Installation

    $ git clone https://github.com/mathiasth/wms-engineer-client.git
    $ cd wms-engineer-client/
    $ npm install

  Check _config.js and update all of the options to meet the requirements of your environment.
  Current configuration requires an installation of MongoDB.
  Start the application:
 
    $ node app.js

The code represents an application only for demonstration and having a starting point for integrating your own workforce managament system instance. It can be used standalone. The code in `platform-dependent` contains some sample data and needs adjustment for proper integration into a working system. Have a look into the `examples` folder for a working integration with the Service Optimization Server by Clicksoftware (http://www.clicksoftware.com), along with a working authentification against Active Directory.

## License 

(The MIT License)

Copyright (c) 2012 Mathias Thuerling &lt;mathias.thuerling@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.