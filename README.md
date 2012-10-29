wms-engineer-client
==================

Simple web client for engineers to integrate with workforce management systems in enterprises

Requires an installation of Node 0.8.x.

## Installation

    $ git clone https://github.com/mathiasth/wms-engineer-client.git
    $ cd wms-engineer-client/
    $ npm install

  Check _config.js and update all of the options to meet the requirements of your environment.
  Current configuration requires an installation of MongoDB.
  Start the application:
 
    $ node app.js

Engineer client will not work without a workforce management system (e.g. Service Optimization Server by ClickSoftware) being accessible in the location defined within the application's configuration.