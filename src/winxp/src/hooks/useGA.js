import { useEffect } from 'react';
import ga from 'react-ga';

function useGA(id, route) {
  useEffect(() => {
    ga.initialize(id);
    ga.pageview(route);
  }, [id, route]);
}

export default useGA;
