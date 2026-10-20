// D4 acceptance test set (SPEC §9): ~20 (dump, query, expect) triples,
// paraphrase-heavy — most queries share few or zero words with their dump.
// Canonical source; test/queries.md is the human-readable rendering of
// this same array, kept in sync by hand (20 fixed items, no codegen needed).
export const QUERIES = [
  { dump: 'Airbnb Lisbon — free cancellation until Jan 3', query: 'refund deadline for the apartment booking' },
  { dump: 'docker run --rm -it -v $(pwd):/app node:22 npm install', query: 'set up dependencies in a container' },
  { dump: "wifi password: Sunflower92!", query: "what's the network password" },
  { dump: 'https://news.ycombinator.com/item?id=38291047 — great thread on rust borrow checker', query: 'that hacker news post about ownership in rust' },
  { dump: '123 Baker Street, London NW1 6XE', query: 'sherlock holmes address' },
  { dump: 'git rebase -i HEAD~3 to squash the last three commits', query: 'combine my recent commits into one' },
  { dump: "mom's birthday is March 14, she likes tulips", query: 'what flowers should I get for mother' },
  { dump: 'npm run build && npm run preview — local prod check before deploy', query: 'how do I test the production build locally' },
  { dump: 'https://www.figma.com/file/abc123/onboarding-flow', query: 'link to the onboarding design' },
  { dump: 'flight confirmation: UA 2201, SFO to JFK, seat 14C, June 9 7am', query: "when's my flight to new york" },
  { dump: '192 Maple Ave, Austin TX 78701 — new office lease starts Feb 1', query: "where's the new office" },
  { dump: 'kubectl rollout restart deployment/api -n prod', query: 'restart the production api pods' },
  { dump: "landlord's number: 555-0199, text don't call", query: 'how do I reach the property manager' },
  { dump: "recipe note: double the yeast if the kitchen's below 65F", query: 'cold kitchen bread tip' },
  { dump: 'https://github.com/facebook/react/pull/28000 — discussion on the new compiler', query: "that PR about react's compiler" },
  { dump: 'car registration renewal due Aug 30, DMV online portal', query: 'when do I need to renew my car tags' },
  { dump: 'openssl req -x509 -newkey rsa:4096 -nodes -keyout key.pem -out cert.pem -days 365', query: 'generate a self-signed TLS certificate' },
  { dump: 'dentist appointment moved to 2:30pm Thursday, same office', query: 'what time is my teeth cleaning' },
  { dump: '450 Ocean Dr, Miami Beach FL 33139 — the airbnb for the bachelor trip', query: 'address for the miami rental' },
  { dump: 'psql -h localhost -U admin -d cubby_dev to connect to the local database', query: 'command to connect to the dev db' },
];
