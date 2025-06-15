import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Grid, Typography, Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { io } from 'socket.io-client';
import RefreshIcon from '@mui/icons-material/Refresh';
import { formatBytes, formatSpeed } from '../utils/formatters';

// Enregistrement des composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

const NetworkStats = () => {
  const [socket, setSocket] = useState(null);
  const [networkStats, setNetworkStats] = useState(null);
  const [deviceStats, setDeviceStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  // Configuration des graphiques
  const chartOptions = {
    responsive: true,
    animation: {
      duration: 0 // Desactive l'animation pour de meilleures performances
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatBytes(value)
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.raw;
            return `${label}: ${formatBytes(value)}`;
          }
        }
      }
    }
  };

  // Initialisation du socket
  useEffect(() => {
    const newSocket = io('http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Connecte au serveur WebSocket');
      setLoading(false);
      // S'abonner aux stats reseau
      newSocket.emit('subscribeNetworkStats');
    });

    newSocket.on('disconnect', () => {
      console.log('Deconnecte du serveur WebSocket');
      setError('Deconnecte du serveur. Tentative de reconnexion...');
    });

    newSocket.on('networkStats', (stats) => {
      setNetworkStats(stats);
      setError(null);
    });

    newSocket.on('error', (error) => {
      console.error('Erreur WebSocket:', error);
      setError('Erreur de connexion au serveur');
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.emit('unsubscribeNetworkStats');
        newSocket.disconnect();
      }
    };
  }, []);

  // S'abonner aux stats d'un appareil
  const subscribeToDeviceStats = useCallback((deviceId) => {
    if (socket && !deviceStats[deviceId]) {
      socket.emit('subscribeDeviceStats', deviceId);
      socket.on(`deviceStats-${deviceId}`, (stats) => {
        setDeviceStats(prev => ({
          ...prev,
          [deviceId]: stats
        }));
      });
    }
  }, [socket, deviceStats]);

  // Se desabonner des stats d'un appareil
  const unsubscribeFromDeviceStats = useCallback((deviceId) => {
    if (socket) {
      socket.emit('unsubscribeDeviceStats', deviceId);
      setDeviceStats(prev => {
        const newStats = { ...prev };
        delete newStats[deviceId];
        return newStats;
      });
    }
  }, [socket]);

  // Preparation des donnees pour le graphique de bande passante
  const prepareBandwidthData = (stats) => {
    if (!stats?.bandwidth) return null;

    return {
      labels: stats.bandwidth.map(s => new Date(s.timestamp).toLocaleTimeString()),
      datasets: [
        {
          label: 'Download',
          data: stats.bandwidth.map(s => s.download),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        },
        {
          label: 'Upload',
          data: stats.bandwidth.map(s => s.upload),
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1
        }
      ]
    };
  };

  // Preparation des donnees pour le graphique de latence
  const prepareLatencyData = (stats) => {
    if (!stats?.latency) return null;

    return {
      labels: stats.latency.map(s => new Date(s.timestamp).toLocaleTimeString()),
      datasets: [
        {
          label: 'Latence',
          data: stats.latency.map(s => s.value),
          borderColor: 'rgb(153, 102, 255)',
          tension: 0.1
        }
      ]
    };
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Grid container spacing={3}>
        {/* Stats generales du reseau */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5">Statistiques Reseau</Typography>
                <Tooltip title="Actualiser">
                  <IconButton onClick={() => socket?.emit('subscribeNetworkStats')}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              
              {networkStats && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6">Bande Passante</Typography>
                        <Typography variant="h4">
                          {formatSpeed(networkStats.bandwidth?.download || 0)} / {formatSpeed(networkStats.bandwidth?.upload || 0)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6">Latence</Typography>
                        <Typography variant="h4">
                          {networkStats.latency?.value || 0} ms
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6">Perte de Paquets</Typography>
                        <Typography variant="h4">
                          {networkStats.packetLoss?.percentage || 0}%
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Graphiques */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Bande Passante</Typography>
              {networkStats && prepareBandwidthData(networkStats) && (
                <Line options={chartOptions} data={prepareBandwidthData(networkStats)} />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Latence</Typography>
              {networkStats && prepareLatencyData(networkStats) && (
                <Line options={chartOptions} data={prepareLatencyData(networkStats)} />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Liste des appareils avec leurs stats */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>Appareils</Typography>
              <Grid container spacing={2}>
                {networkStats?.devices?.map((device) => (
                  <Grid item xs={12} md={6} lg={4} key={device.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6">{device.name}</Typography>
                        <Typography color="textSecondary">
                          {device.ip} - {device.mac}
                        </Typography>
                        <Box mt={2}>
                          <Typography variant="body2">
                            Bande passante: {formatSpeed(device.bandwidth?.download || 0)} / {formatSpeed(device.bandwidth?.upload || 0)}
                          </Typography>
                          <Typography variant="body2">
                            Latence: {device.latency?.value || 0} ms
                          </Typography>
                          <Typography variant="body2">
                            CPU: {device.cpu?.usage || 0}%
                          </Typography>
                          <Typography variant="body2">
                            Memoire: {formatBytes(device.memory?.used || 0)} / {formatBytes(device.memory?.total || 0)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NetworkStats; 