import { Platform } from 'react-native';

// react-native-web renders <TextInput> as a plain <input>/<textarea>, which
// browsers style on their own (focus ring, autofill fill, Edge's built-in
// password-reveal icon) regardless of the RN style prop. +html.tsx only runs
// when web.output is "static" — this project builds "single" (SPA) output,
// so that file's <style> tag never ships. Injecting the same reset here at
// module load time, before the app tree mounts, makes it work under either
// output mode.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('rr-web-reset')) {
  const style = document.createElement('style');
  style.id = 'rr-web-reset';
  style.textContent = `
    input, textarea {
      -webkit-appearance: none;
      appearance: none;
      outline: none;
      outline-style: none;
      box-shadow: none !important;
      border: 0;
    }
    input:focus, textarea:focus {
      outline: none !important;
      border-color: inherit;
      box-shadow: none !important;
    }
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus {
      -webkit-transition: background-color 9999s ease-out;
      transition: background-color 9999s ease-out;
      -webkit-background-clip: text;
      background-clip: text;
    }
    /* Edge/IE draw their own "reveal password" eye inside type=password
       inputs, which doubles up with TextField's own Ionicons toggle. */
    input::-ms-reveal, input::-ms-clear {
      display: none;
    }
  `;
  document.head.appendChild(style);
}
