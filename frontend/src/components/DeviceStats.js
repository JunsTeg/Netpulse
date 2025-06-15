import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Line } from 'react-chartjs-2';
import { io } from 'socket.io-client';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import { formatBytes, formatSpeed } from '../utils/formatters';

const DeviceStats = ({ device, open, onClose }) => {
  const [socket, setSocket] = useState(null);
  const [deviceStats, setDeviceStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Configuration des graphiques
  const chartOptions = {
    responsive: true,
    animation: {
      duration: 0
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
    if (!device || !open) return;

    const newSocket = io('http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Connecte au serveur WebSocket pour les stats appareil');
      setLoading(false);
      // S'abonner aux stats de l'appareil
      newSocket.emit('subscribeDeviceStats', device.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Deconnecte du serveur WebSocket');
      setError('Deconnecte du serveur. Tentative de reconnexion...');
    });

    newSocket.on(`deviceStats-${device.id}`, (stats) => {
      setDeviceStats(stats);
      setError(null);
    });

    newSocket.on('error', (error) => {
      console.error('Erreur WebSocket:', error);
      setError('Erreur de connexion au serveur');
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.emit('unsubscribeDeviceStats', device.id);
        newSocket.disconnect();
      }
    };
  }, [device, open]);

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

  // Preparation des donnees pour le graphique CPU/Memoire
  const prepareResourceData = (stats) => {
    if (!stats?.cpu || !stats?.memory) return null;

    return {
      labels: stats.cpu.map(s => new Date(s.timestamp).toLocaleTimeString()),
      datasets: [
        {
          label: 'CPU',
          data: stats.cpu.map(s => s.usage),
          borderColor: 'rgb(255, 159, 64)',
          tension: 0.1
        },
        {
          label: 'Memoire',
          data: stats.memory.map(s => (s.used / s.total) * 100),
          borderColor: 'rgb(54, 162, 235)',
          tension: 0.1
        }
      ]
    };
  };

  if (!device) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Statistiques de {device.name}
          </Typography>
          <Box>
            <Tooltip title="Actualiser">
              <IconButton onClick={() => socket?.emit('subscribeDeviceStats', device.id)}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <Typography color="error">{error}</Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Stats generales */}
            <Grid item xs={12}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6">Bande Passante</Typography>
                      <Typography variant="h4">
                        {formatSpeed(deviceStats?.bandwidth?.download || 0)} / {formatSpeed(deviceStats?.bandwidth?.upload || 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6">Latence</Typography>
                      <Typography variant="h4">
                        {deviceStats?.latency?.value || 0} ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6">CPU</Typography>
                      <Typography variant="h4">
                        {deviceStats?.cpu?.usage || 0}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6">Memoire</Typography>
                      <Typography variant="h4">
                        {formatBytes(deviceStats?.memory?.used || 0)} / {formatBytes(deviceStats?.memory?.total || 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>

            {/* Graphiques */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Bande Passante</Typography>
                  {deviceStats && prepareBandwidthData(deviceStats) && (
                    <Line options={chartOptions} data={prepareBandwidthData(deviceStats)} />
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Latence</Typography>
                  {deviceStats && prepareLatencyData(deviceStats) && (
                    <Line options={chartOptions} data={prepareLatencyData(deviceStats)} />
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Utilisation des Ressources</Typography>
                  {deviceStats && prepareResourceData(deviceStats) && (
                    <Line options={chartOptions} data={prepareResourceData(deviceStats)} />
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Informations detaillees */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Informations Detaillees</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1">Adresse IP</Typography>
                      <Typography variant="body1">{device.ip}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1">Adresse MAC</Typography>
                      <Typography variant="body1">{device.mac}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1">Type d'Appareil</Typography>
                      <Typography variant="body1">{device.deviceType}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1">Derniere Vue</Typography>
                      <Typography variant="body1">
                        {new Date(device.lastSeen).toLocaleString()}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DeviceStats; 