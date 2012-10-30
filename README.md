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

(The BSD 3-Clause License)

Copyright (c) 2012, Mathias Thuerling &lt;mathias.thuerling@gmail.com&gt;

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * The names of its contributors may not be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.