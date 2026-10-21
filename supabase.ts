
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';

const supabaseUrl = 'https://nrcygmbcwigrnadbbisp.supabase.co';
const supabaseKey = 'sb_publishable_HWDvdIORh9rAUb3ETdB-cQ_Mp0YNrBS';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
