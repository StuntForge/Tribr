// Points the app at your local backend.
//
// Currently set to an ngrok tunnel so testers off your home network can
// reach it. This URL changes every time the tunnel is restarted - if
// testing stops working, get the new address from the ngrok terminal (or
// http://localhost:4040) and update it here.
//
// To go back to same-Wi-Fi-only testing, swap this for your computer's LAN
// IP instead (run `ipconfig` on Windows, look for "IPv4 Address"), e.g.
// "http://192.168.1.203:4000".
export const API_BASE_URL = "https://unranked-wasp-headsman.ngrok-free.dev";
