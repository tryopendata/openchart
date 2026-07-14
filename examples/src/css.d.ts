// Ambient declarations for the side-effect stylesheet imports the stories use.
// Vite resolves these at build time; tsc needs to be told they're valid modules.
declare module '*.css';
