import DeviceStats from '../../components/DeviceStats';

const Devices = () => {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showDeviceStats, setShowDeviceStats] = useState(false);

  const handleDeviceClick = (device) => {
    setSelectedDevice(device);
    setShowDeviceStats(true);
  };

  const handleCloseDeviceStats = () => {
    setShowDeviceStats(false);
    setSelectedDevice(null);
  };

  const columns = [
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            onClick={() => handleDeviceClick(record)}
            icon={<LineChartOutlined />}
          >
            Stats
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <DeviceStats
        device={selectedDevice}
        open={showDeviceStats}
        onClose={handleCloseDeviceStats}
      />
    </div>
  );
};

export default Devices; 