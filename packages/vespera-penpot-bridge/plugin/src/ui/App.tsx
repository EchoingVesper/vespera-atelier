/**
 * Main App component
 */

import { PluginProvider } from './state/context';
import { ChatInterface } from './components/ChatInterface';
import './App.css';

function App() {
  return (
    <PluginProvider>
      <ChatInterface />
    </PluginProvider>
  );
}

export default App;