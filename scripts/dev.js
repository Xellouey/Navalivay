#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { networkInterfaces } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const botMode = args.includes('--bot');

console.log('🚀 Starting NAVALIVAY development environment...\n');

// Helper function to spawn a process with proper output handling
function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'pipe',
    shell: true,
    ...options
  });

  return child;
}

// Color codes for different processes
const colors = {
  frontend: '\x1b[36m', // Cyan
  server: '\x1b[33m',   // Yellow
  bot: '\x1b[35m',      // Magenta
  reset: '\x1b[0m'
};

function getLocalIPv4() {
  const nets = networkInterfaces();
  const results = [];

  Object.values(nets).forEach((interfaces) => {
    interfaces?.forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    });
  });

  return results;
}

const localIPs = getLocalIPv4();

// Function to add colored prefix to output
function addPrefix(data, prefix, color) {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    console.log(`${color}[${prefix}]${colors.reset} ${line}`);
  });
}

// Start frontend development server
console.log('🎨 Starting frontend development server...');
const frontend = spawnProcess('npm', ['run', 'dev', '--', '--host', '0.0.0.0', '--port', '5173'], {
  cwd: join(projectRoot, 'frontend')
});

frontend.stdout.on('data', (data) => {
  addPrefix(data, 'FRONTEND', colors.frontend);
});

frontend.stderr.on('data', (data) => {
  addPrefix(data, 'FRONTEND', colors.frontend);
});

frontend.on('error', (error) => {
  console.error(`${colors.frontend}[FRONTEND ERROR]${colors.reset} Failed to start frontend:`, error);
});

// Start backend server
console.log('⚙️  Starting backend server...');
const serverCommand = botMode ? 'start:bot' : 'dev';
const server = spawnProcess('npm', ['run', serverCommand], {
  cwd: join(projectRoot, 'server')
});

server.stdout.on('data', (data) => {
  const prefix = botMode ? 'SERVER+BOT' : 'SERVER';
  const color = botMode ? colors.bot : colors.server;
  addPrefix(data, prefix, color);
});

server.stderr.on('data', (data) => {
  const prefix = botMode ? 'SERVER+BOT' : 'SERVER';
  const color = botMode ? colors.bot : colors.server;
  addPrefix(data, prefix, color);
});

server.on('error', (error) => {
  const prefix = botMode ? 'SERVER+BOT ERROR' : 'SERVER ERROR';
  const color = botMode ? colors.bot : colors.server;
  console.error(`${color}[${prefix}]${colors.reset} Failed to start server:`, error);
});

// Handle process termination
let isShuttingDown = false;

function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('\n🛑 Shutting down development servers...');
  
  try {
    frontend.kill('SIGTERM');
  } catch (err) {
    // Process might already be dead
  }
  
  try {
    server.kill('SIGTERM');
  } catch (err) {
    // Process might already be dead
  }
  
  // Force kill after timeout
  setTimeout(() => {
    try {
      frontend.kill('SIGKILL');
      server.kill('SIGKILL');
    } catch (err) {
      // Processes might already be dead
    }
    process.exit(0);
  }, 5000);
}

// Handle various ways the process might be terminated
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('exit', gracefulShutdown);

// Handle child process exits
frontend.on('exit', (code, signal) => {
  if (!isShuttingDown) {
    console.log(`${colors.frontend}[FRONTEND]${colors.reset} Process exited with code ${code} and signal ${signal}`);
    gracefulShutdown();
  }
});

server.on('exit', (code, signal) => {
  if (!isShuttingDown) {
    const prefix = botMode ? 'SERVER+BOT' : 'SERVER';
    const color = botMode ? colors.bot : colors.server;
    console.log(`${color}[${prefix}]${colors.reset} Process exited with code ${code} and signal ${signal}`);
    gracefulShutdown();
  }
});

console.log('✅ Development environment started!');
console.log(`📱 Frontend: http://localhost:5173`);
console.log(`🔧 Backend: http://localhost:8082`);
if (localIPs.length) {
  console.log('\n🌐 Доступ из локальной сети:');
  localIPs.forEach((ip) => {
    console.log(`   • Frontend: http://${ip}:5173`);
    console.log(`   • Backend:  http://${ip}:8082`);
  });
  console.log('\n📱 Откройте один из адресов выше на телефоне, подключённом к той же сети.');
} else {
  console.log('\n⚠️ Не удалось определить локальный IP-адрес. Проверьте настройки сети.');
}
if (botMode) {
  console.log(`🤖 Telegram Bot: Active`);
}
console.log('\n💡 Press Ctrl+C to stop all servers\n');