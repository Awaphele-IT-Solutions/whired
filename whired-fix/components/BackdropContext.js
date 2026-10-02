import { createContext, useContext } from 'react';

// True when a parent (the tab shell) already renders the shared dot-field
// backdrop and owns the bottom safe area, so a Screen should not add its own.
export const BackdropContext = createContext(false);
export const useBackdrop = () => useContext(BackdropContext);
