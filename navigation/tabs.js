import { createContext, useContext } from 'react';

// Lets any tab screen switch tabs (optionally handing over params) and ask
// whether it is the visible one.
export const TabsContext = createContext({
  active: 'home',
  params: {},
  goTo: () => {},
});

export const useTabs = () => useContext(TabsContext);

export function useTabActive(key) {
  return useTabs().active === key;
}
