// Static device discovery for development (no mDNS)
function discoverDevices() {
  return Promise.resolve([
    {
      id: 'WORKSHOP speaker',
      address: '192.168.4.24', // Example IP, not used in this mock
      port: 3001,
      fullname: 'Workshop Speaker',
      txtRecord: {}
    }
  ]);
}

module.exports = { discoverDevices };