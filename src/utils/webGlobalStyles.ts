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
    /* dvh follows the visual viewport (shrinks when the on-screen keyboard
       opens), where the % rules in Expo's own web template only follow the
       *layout* viewport — which by default stays full-height under the
       keyboard on Android Chrome, pushing anything pinned to the bottom of a
       flex:1 column (chat's composer bar, here) behind it. The % rule stays
       first as the fallback for browsers with no dvh support. */
    html, body, #root {
      height: 100%;
      height: 100dvh;
    }
  `;
  document.head.appendChild(style);

  // Chrome's default is to resize only the *visual* viewport for the on-screen
  // keyboard, leaving 100%/100dvh-sized layout untouched — resizes-content is
  // what makes the layout viewport (and so the dvh rule above) actually
  // shrink around the keyboard instead of being covered by it.
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  const content = viewportMeta?.getAttribute('content') ?? '';
  if (viewportMeta && !content.includes('interactive-widget')) {
    viewportMeta.setAttribute('content', `${content}, interactive-widget=resizes-content`);
  }
}
