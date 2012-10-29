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