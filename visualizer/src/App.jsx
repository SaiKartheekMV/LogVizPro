import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  ThemeProvider,
  createTheme,
  CssBaseline,
  ButtonGroup
} from '@mui/material';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import {
  MdActivity,
  MdError,
  MdWarning,
  MdInfo,
  MdRefresh,
  MdFilterList,
  MdDashboard
} from 'react-icons/md';
import axios from 'axios';

const API_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:5000';

// Dark theme configuration
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#0a1929',
      paper: '#132f4c',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
    success: {
      main: '#4caf50',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

const COLORS = ['#2196f3', '#f44336', '#ff9800', '#4caf50'];

function App() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/logs?limit=100`),
        axios.get(`${API_URL}/logs/stats`)
      ]);

      setLogs(logsRes.data.logs);
      setStats(statsRes.data.stats);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = filter === 'ALL'
    ? logs
    : logs.filter(log => log.level === filter);

  const levelCounts = stats ? stats.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {}) : {};

  const pieData = stats ? stats.map(item => ({
    name: item._id,
    value: item.count
  })) : [];

  const getIcon = (level) => {
    const iconProps = { size: 20 };
    switch (level) {
      case 'ERROR':
        return <MdError {...iconProps} style={{ color: '#f44336' }} />;
      case 'WARNING':
        return <MdWarning {...iconProps} style={{ color: '#ff9800' }} />;
      case 'INFO':
        return <MdInfo {...iconProps} style={{ color: '#2196f3' }} />;
      default:
        return <MdActivity {...iconProps} style={{ color: '#9e9e9e' }} />;
    }
  };

  const getLevelChip = (level) => {
    const colorMap = {
      ERROR: 'error',
      WARNING: 'warning',
      INFO: 'info',
      DEBUG: 'default'
    };
    return <Chip label={level} color={colorMap[level] || 'default'} size="small" />;
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                <MdDashboard style={{ verticalAlign: 'middle', marginRight: '10px' }} />
                LogViz Pro
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Real-time Log Analytics Dashboard
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <MdRefresh />}
              onClick={fetchData}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'background.paper', height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography color="text.secondary" variant="subtitle2" gutterBottom>
                        Total Logs
                      </Typography>
                      <Typography variant="h4" component="div" sx={{ fontWeight: 700 }}>
                        {logs.length}
                      </Typography>
                    </Box>
                    <MdActivity size={48} style={{ color: '#2196f3', opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'background.paper', height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography color="text.secondary" variant="subtitle2" gutterBottom>
                        Errors
                      </Typography>
                      <Typography variant="h4" component="div" sx={{ fontWeight: 700, color: 'error.main' }}>
                        {levelCounts['ERROR'] || 0}
                      </Typography>
                    </Box>
                    <MdError size={48} style={{ color: '#f44336', opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'background.paper', height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography color="text.secondary" variant="subtitle2" gutterBottom>
                        Warnings
                      </Typography>
                      <Typography variant="h4" component="div" sx={{ fontWeight: 700, color: 'warning.main' }}>
                        {levelCounts['WARNING'] || 0}
                      </Typography>
                    </Box>
                    <MdWarning size={48} style={{ color: '#ff9800', opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'background.paper', height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography color="text.secondary" variant="subtitle2" gutterBottom>
                        Info
                      </Typography>
                      <Typography variant="h4" component="div" sx={{ fontWeight: 700, color: 'info.main' }}>
                        {levelCounts['INFO'] || 0}
                      </Typography>
                    </Box>
                    <MdInfo size={48} style={{ color: '#2196f3', opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Card sx={{ bgcolor: 'background.paper' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Log Level Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ bgcolor: 'background.paper' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Log Count by Level
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={pieData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#37474f" />
                      <XAxis dataKey="name" stroke="#90a4ae" />
                      <YAxis stroke="#90a4ae" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#132f4c', border: 'none', borderRadius: '8px' }}
                      />
                      <Bar dataKey="value" fill="#2196f3" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filters */}
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <MdFilterList size={24} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Filter by Level:
            </Typography>
            <ButtonGroup variant="outlined">
              {['ALL', 'INFO', 'WARNING', 'ERROR'].map((level) => (
                <Button
                  key={level}
                  variant={filter === level ? 'contained' : 'outlined'}
                  onClick={() => setFilter(level)}
                >
                  {level}
                </Button>
              ))}
            </ButtonGroup>
          </Box>

          {/* Logs Table */}
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                Recent Logs ({filteredLogs.length})
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 600, bgcolor: 'background.default' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>Level</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>Message</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>Source</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>Timestamp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLogs.map((log, index) => (
                      <TableRow
                        key={index}
                        sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getIcon(log.level)}
                            {getLevelChip(log.level)}
                          </Box>
                        </TableCell>
                        <TableCell>{log.message}</TableCell>
                        <TableCell>
                          <Chip label={log.source} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;