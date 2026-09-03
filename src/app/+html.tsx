import { ScrollViewStyleReset } from 'expo-router/html';

// Comic: first route of the app renders via this file on web. Global styles
// injected in <head> so the browser's own input styling (the default focus
// outline and autofill backgrounds) can never paint over the app's theme —
// react-native-web <TextInput> renders a native <input>, which browsers style
// on their own regardless of the RN style prop unless told otherwise here.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: resetStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Kill the browser's default chrome on every text box so a focused input never
// draws its own border / background over the thematic field. Autofill keeps its
// special blue/yellow fill out of the way too, on the standards-compliant
// pseudo-classes modern browsers use.
const resetStyles = `
  input, textarea {
    -webkit-appearance: none;
    appearance: none;
    outline: none;
    outline-style: none;
    box-shadow: none !important;
    /* The UA stylesheet's own 1px border, which `appearance: none` leaves
       behind. It is what drew a square box inside the rounded search pill: the
       field's border belongs to the row around the input, and the input itself
       should have none. Plain element selector, not `!important`, so a
       TextInput that really does set a border in its RN styles still wins —
       react-native-web's class rules outrank this one. */
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
`;