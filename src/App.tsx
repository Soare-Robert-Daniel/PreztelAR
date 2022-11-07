import { Component, lazy, onMount } from 'solid-js';

import styles from './App.module.css';

const Canvas = lazy(() => import('./canvas'))

const App: Component = () => {

  onMount(() => {
    
  })
  
  return (
    <div class="dark:bg-gray-800">
      <Canvas />
    </div>
  );
};

export default App;
