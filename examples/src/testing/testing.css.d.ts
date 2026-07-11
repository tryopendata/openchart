// Ambient declaration so `import './testing.css'` in the fixture stories
// type-checks. The fixture files import the frozen stylesheet directly (rather
// than relying on the global import in .ladle/components.tsx) so the Testing
// section stays self-contained and its `.tfix-` layout classes always load.
declare module './testing.css';
