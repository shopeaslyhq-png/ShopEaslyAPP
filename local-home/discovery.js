// Device discovery using mDNS for Google Local Home SDK
// This module exports a function to discover smart home devices on the local network

const mdns = require('mdns');

function discoverDevices(serviceType = '_http._tcp') {
  return new Promise((resolve, reject) => {
    const discovered = [];
    const browser = mdns.createBrowser(mdns.tcp(serviceType));

    browser.on('serviceUp', service => {
      discovered.push({
        id: service.name,
        address: service.addresses[0],
        port: service.port,
        fullname: service.fullname,
        txtRecord: service.txtRecord
      });
    });

    browser.on('error', err => {
      browser.stop();
      reject(err);
    });

    browser.on('serviceDown', service => {
      // Optionally handle device going offline
    });

    browser.start();

    // Stop discovery after 3 seconds and return results
    setTimeout(() => {
      browser.stop();
      resolve(discovered);
    }, 3000);
  });
}

module.exports = { discoverDevices };