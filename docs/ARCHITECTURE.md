# Arquitetura

Fluxo: UI React → `TSEElectionProvider` → `ScheduledTSETransport` → fila global → `DirectTSETransport` → parser → modelo normalizado → IndexedDB. Raw e normalizado são gravados em stores diferentes. A fila é compartilhada por 2022, 2026, diagnóstico e polling, impedindo que uma funcionalidade contorne o limite. Para 2026: EA11 → `ElectionDiscoveryService` → `DirectoryTemplateResolver` → URL builder → EA12/EA14/EA15/EA20.

O build usa caminhos relativos (`base: './'`) e não exige servidor, portanto é compatível com GitHub Pages.
