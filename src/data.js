import {everydayRows,popCultureRows} from './vocabulary.js';

// Original association packs. Each row is a theme, domain, difficulty, and word pool.
// Words may belong to many themes. Only a particular puzzle deck rejects repeats.
const rows = `
Trees|nature|1|Oak,Maple,Birch,Pine,Elm,Cedar,Willow,Aspen
Flowers|nature|1|Rose,Tulip,Daisy,Lily,Iris,Peony,Dahlia,Marigold
Weather|nature|1|Rain,Snow,Wind,Sunshine,Fog,Hail,Sleet,Thunder
Landforms|nature|1|Mountain,Valley,Plateau,Canyon,Hill,Plain,Cliff,Dune
Bodies of water|nature|1|River,Lake,Ocean,Pond,Stream,Sea,Lagoon,Bay
Autumn|nature|1|Acorn,Harvest,Scarecrow,Pumpkin,Leaves,Cider,Hayride,Chestnut
Beach|nature|1|Sand,Seashell,Tide,Driftwood,Surf,Pebble,Seaweed,Dune
Gemstones|nature|2|Ruby,Emerald,Sapphire,Diamond,Opal,Amethyst,Topaz,Garnet
Clouds|nature|2|Cirrus,Cumulus,Stratus,Nimbus,Altostratus,Altocumulus,Cirrostratus,Cirrocumulus
Tree|nature|1|Root,Trunk,Branch,Leaf,Bark,Canopy,Twig,Sap
Volcano|nature|2|Lava,Magma,Crater,Ash,Caldera,Vent,Tephra,Eruption
Garden|nature|1|Soil,Seed,Trowel,Compost,Mulch,Planter,Hoe,Watering can,Flowers
Natural disasters|nature|2|Earthquake,Tsunami,Hurricane,Tornado,Avalanche,Flood,Wildfire,Drought
Biomes|nature|2|Tundra,Taiga,Savanna,Desert,Rainforest,Grassland,Wetland,Chaparral
Rocks|nature|2|Granite,Basalt,Marble,Slate,Limestone,Sandstone,Obsidian,Pumice
Evergreen trees|nature|2|Spruce,Fir,Hemlock,Juniper,Yew,Sequoia,Cypress,Redwood
Succulents|nature|2|Aloe,Agave,Echeveria,Jade,Haworthia,Sedum,Sempervivum,Lithops
Mushrooms|nature|2|Shiitake,Morel,Chanterelle,Porcini,Enoki,Oyster mushroom,Cremini,Portobello
Ocean currents|nature|3|Gulf Stream,Kuroshio,Humboldt,Benguela,Labrador,Canary,Agulhas,Oyashio
Things that glow|nature|2|Firefly,Glowworm,Aurora,Ember,Lantern,Neon,Bioluminescence,Phosphor
Water cycle|nature|2|Evaporation,Condensation,Precipitation,Collection,Runoff,Infiltration,Transpiration,Sublimation
Named winds|nature|3|Mistral,Sirocco,Chinook,Bora,Monsoon,Trade wind,Harmattan,Zonda
Geological eras|nature|3|Cambrian,Ordovician,Silurian,Devonian,Permian,Triassic,Jurassic,Cretaceous
Ice|nature|1|Glacier,Icicle,Iceberg,Ice cube,Ice rink,Ice sculpture,Frost,Hailstone
Fruit|food|1|Apple,Pear,Peach,Plum,Orange,Mango,Banana,Grape
Berries|food|1|Strawberry,Blueberry,Raspberry,Blackberry,Cranberry,Gooseberry,Elderberry,Mulberry
Vegetables|food|1|Carrot,Broccoli,Cabbage,Spinach,Pea,Zucchini,Radish,Celery
Baking|food|1|Flour,Butter,Sugar,Egg,Yeast,Cocoa,Vanilla,Baking powder
Pasta shapes|food|2|Penne,Fusilli,Rigatoni,Orzo,Farfalle,Rotini,Macaroni,Orecchiette
Cheeses|food|2|Brie,Cheddar,Gouda,Feta,Mozzarella,Manchego,Roquefort,Parmesan
Herbs|food|1|Basil,Thyme,Rosemary,Sage,Mint,Dill,Parsley,Cilantro
Spices|food|2|Cinnamon,Nutmeg,Cumin,Turmeric,Paprika,Clove,Cardamom,Saffron
Breakfast|food|1|Pancake,Waffle,Omelet,Toast,Granola,Porridge,Bacon,Hash brown
Bakery|food|1|Croissant,Baguette,Bagel,Muffin,Scone,Brioche,Pretzel,Crumpet
Ice cream|food|1|Chocolate,Vanilla,Strawberry,Pistachio,Caramel,Mint chip,Cookie dough,Butter pecan
Coffee|food|2|Espresso,Latte,Cappuccino,Americano,Mocha,Macchiato,Cortado,Flat white
Tea|food|2|Oolong,Matcha,Earl Grey,Chamomile,Darjeeling,Assam,Sencha,Rooibos
Pizza|food|1|Pepperoni,Mushroom,Olive,Anchovy,Artichoke,Jalapeno,Sausage,Pineapple
Sweets|food|1|Brownie,Truffle,Cupcake,Fudge,Toffee,Macaron,Bonbon,Marshmallow
Citrus fruits|food|2|Lemon,Lime,Grapefruit,Tangerine,Clementine,Kumquat,Yuzu,Pomelo
Nuts and kernels|food|1|Almond,Walnut,Cashew,Hazelnut,Pecan,Macadamia,Pistachio,Brazil nut
Legumes|food|2|Lentil,Chickpea,Kidney bean,Black bean,Soybean,Lima bean,Mung bean,Pinto bean
Grains|food|2|Rice,Wheat,Barley,Oat,Millet,Rye,Sorghum,Spelt
Cooking methods|food|1|Roast,Bake,Boil,Steam,Grill,Saute,Poach,Braise
French desserts|food|2|Eclair,Mille-feuille,Madeleine,Financier,Clafoutis,Creme brulee,Profiterole,Tarte tatin
Japanese food|food|2|Sushi,Ramen,Udon,Tempura,Onigiri,Miso,Soba,Yakitori
Indian dishes|food|2|Biryani,Dosa,Samosa,Dal,Paneer tikka,Naan,Chana masala,Aloo gobi
Mexican food|food|1|Taco,Burrito,Enchilada,Quesadilla,Tamale,Tostada,Chilaquiles,Pozole
Farm animals|animals|1|Cow,Pig,Sheep,Goat,Horse,Chicken,Donkey,Duck
Household pets|animals|1|Dog,Cat,Hamster,Goldfish,Parakeet,Guinea pig,Rabbit,Gerbil
Big cats|animals|1|Lion,Tiger,Leopard,Jaguar,Cheetah,Cougar,Snow leopard,Lynx
Ocean animals|animals|1|Whale,Dolphin,Octopus,Shark,Seahorse,Jellyfish,Stingray,Seal
Woodland animals|animals|1|Fox,Deer,Badger,Squirrel,Hedgehog,Raccoon,Moose,Beaver
Birds of prey|animals|2|Eagle,Hawk,Falcon,Owl,Kestrel,Osprey,Kite,Harrier
Garden birds|animals|1|Robin,Sparrow,Finch,Wren,Blackbird,Blue jay,Cardinal,Chickadee
Insects|animals|1|Ant,Bee,Beetle,Butterfly,Dragonfly,Grasshopper,Ladybug,Moth
Reptiles|animals|1|Snake,Lizard,Turtle,Crocodile,Gecko,Iguana,Chameleon,Tortoise
Amphibians|animals|2|Frog,Toad,Newt,Salamander,Axolotl,Caecilian,Hellbender,Mudpuppy
Dog breeds|animals|2|Beagle,Poodle,Collie,Husky,Dalmatian,Corgi,Shiba inu,Dachshund
Cat breeds|animals|2|Siamese,Persian,Bengal,Ragdoll,Sphynx,Maine coon,Abyssinian,Burmese
Animal groups|animals|2|Herd,Flock,Pack,Swarm,Pride,Pod,Colony,Troop
Baby animals|animals|1|Puppy,Kitten,Calf,Lamb,Foal,Chick,Cub,Fawn
Animal homes|animals|1|Nest,Den,Burrow,Hive,Web,Stable,Kennel,Hutch
Flightless birds|animals|2|Penguin,Ostrich,Emu,Kiwi,Cassowary,Rhea,Kakapo,Takahe
Primates|animals|2|Gorilla,Chimpanzee,Orangutan,Gibbon,Lemur,Baboon,Macaque,Tamarin
Marsupials|animals|2|Kangaroo,Koala,Wombat,Wallaby,Opossum,Quokka,Bandicoot,Tasmanian devil
Whales|animals|2|Humpback,Blue whale,Orca,Beluga,Narwhal,Sperm whale,Minke,Gray whale
Freshwater fish|animals|2|Trout,Salmon,Carp,Perch,Pike,Catfish,Sturgeon,Bluegill,Bass
Dinosaurs|animals|2|Triceratops,Stegosaurus,Diplodocus,Velociraptor,Ankylosaurus,Iguanodon,Allosaurus,Spinosaurus
Animal defenses|animals|2|Camouflage,Quill,Shell,Venom,Ink,Antler,Claw,Sting
Nocturnal animals|animals|2|Bat,Owl,Aardvark,Slow loris,Kinkajou,Bush baby,Porcupine,Sugar glider
Animal sounds|animals|1|Moo,Bark,Meow,Neigh,Oink,Quack,Roar,Chirp
Planets|space|1|Mercury,Venus,Earth,Mars,Jupiter,Saturn,Uranus,Neptune
Night sky|space|1|Star,Moon,Comet,Meteor,Constellation,Galaxy,Aurora,Milky Way
Space travel|space|1|Rocket,Satellite,Astronaut,Spacesuit,Shuttle,Launchpad,Orbiter,Space station
Moon phases|space|2|New moon,Full moon,First quarter,Last quarter,Waxing crescent,Waning crescent,Waxing gibbous,Waning gibbous
Constellations|space|2|Orion,Cassiopeia,Andromeda,Ursa Major,Cygnus,Draco,Pegasus,Lyra
Zodiac signs|space|1|Aries,Taurus,Gemini,Cancer,Leo,Virgo,Libra,Scorpio
Moons of Jupiter|space|3|Io,Europa,Ganymede,Callisto,Amalthea,Himalia,Elara,Pasiphae
Space probes|space|2|Voyager,Pioneer,Cassini,Juno,New Horizons,Galileo,Rosetta,Mariner
Stellar objects|space|2|Pulsar,Quasar,Nebula,Supernova,White dwarf,Red giant,Black hole,Neutron star
Astronomy tools|space|2|Telescope,Observatory,Spectroscope,Star chart,Astrolabe,Photometer,Coronagraph,Radio dish
Space agencies|space|2|NASA,ESA,JAXA,ISRO,CNSA,CSA,UKSA,DLR
Astronauts|space|2|Armstrong,Aldrin,Gagarin,Tereshkova,Ride,Jemison,Hadfield,Glenn
Solar system objects|space|2|Asteroid,Comet,Meteoroid,Planet,Dwarf planet,Moon,Kuiper belt,Oort cloud
Satellite purposes|space|2|Navigation,Communication,Weather imaging,Earth observation,Reconnaissance,Astronomy,Mapping,Research
Units of distance|science|2|Meter,Kilometer,Mile,Yard,Foot,Inch,Light-year,Parsec
Laboratory|science|1|Beaker,Test tube,Microscope,Pipette,Flask,Petri dish,Centrifuge,Bunsen burner
Chemical elements|science|2|Hydrogen,Helium,Carbon,Oxygen,Nitrogen,Neon,Sodium,Iron
States of matter|science|2|Solid,Liquid,Gas,Plasma
Human bones|science|2|Femur,Tibia,Fibula,Humerus,Radius,Ulna,Patella,Scapula
Body organs|science|1|Heart,Lung,Liver,Kidney,Brain,Stomach,Pancreas,Spleen
Senses|science|1|Sight,Hearing,Touch,Taste,Smell
Cell|science|2|Nucleus,Membrane,Cytoplasm,Mitochondrion,Ribosome,Vacuole,Golgi body,Lysosome
Measuring tools|science|1|Ruler,Scale,Thermometer,Barometer,Stopwatch,Caliper,Protractor,Hygrometer
Physics concepts|science|2|Gravity,Inertia,Friction,Momentum,Velocity,Acceleration,Energy,Force
Simple machines|science|2|Lever,Pulley,Wedge,Screw,Wheel,Inclined plane
Subatomic particles|science|3|Electron,Proton,Neutron,Quark,Muon,Neutrino,Photon,Gluon
Branches of biology|science|2|Botany,Zoology,Ecology,Genetics,Microbiology,Anatomy,Entomology,Mycology
Metric prefixes|science|2|Kilo,Centi,Milli,Micro,Nano,Mega,Giga,Tera
Electrical components|science|2|Resistor,Capacitor,Diode,Transistor,Inductor,Relay,Switch,Fuse
Energy|science|2|Kinetic,Potential,Thermal,Chemical,Nuclear,Electrical,Radiant,Elastic
Blood components|science|2|Plasma,Platelet,Red cell,White cell
Scientific pioneers|science|2|Curie,Newton,Einstein,Darwin,Galileo,Tesla,Faraday,Bohr
Living room|home|1|Sofa,Armchair,Bookcase,Rug,Lamp,Cushion,Coffee table,Fireplace
Kitchen utensils|home|1|Whisk,Spatula,Ladle,Colander,Peeler,Tongs,Grater,Rolling pin
Household appliances|home|1|Fridge,Oven,Toaster,Blender,Kettle,Dishwasher,Microwave,Freezer
Bedroom|home|1|Bed,Pillow,Blanket,Dresser,Nightstand,Mattress,Duvet,Wardrobe
Bathroom|home|1|Soap,Shampoo,Toothbrush,Toothpaste,Comb,Razor,Floss,Conditioner
Cleaning|home|1|Broom,Mop,Vacuum,Duster,Detergent,Sponge,Dustpan,Bucket
Tools|home|1|Hammer,Saw,Wrench,Drill,Pliers,Screwdriver,Chisel,File
Chairs|home|2|Stool,Recliner,Rocking chair,Chaise,Beanbag,Ottoman,Bench,Wingback
Building materials|home|1|Brick,Concrete,Timber,Glass,Steel,Stone,Plaster,Tile
House styles|home|2|Bungalow,Cottage,Chalet,Townhouse,Duplex,Villa,Victorian,Tudor
Door hardware|home|2|Hinge,Handle,Knob,Latch,Deadbolt,Doorbell,Knocker,Strike plate
Bed linens|home|1|Sheet,Pillowcase,Quilt,Duvet cover,Comforter,Bedspread,Throw,Valance
Flooring|home|2|Hardwood,Laminate,Linoleum,Carpet,Terrazzo,Parquet,Cork,Vinyl
Table setting|home|1|Plate,Bowl,Fork,Knife,Spoon,Napkin,Glass,Placemat
Sewing|home|2|Needle,Thread,Thimble,Bobbin,Pincushion,Seam ripper,Tape measure,Pin
Clothes|style|1|Shirt,Trousers,Dress,Skirt,Jacket,Sweater,Shorts,Coat
Footwear|style|1|Sneaker,Boot,Sandal,Slipper,Loafer,Clog,Espadrille,Moccasin
Headwear|style|1|Beanie,Beret,Fedora,Cap,Bonnet,Turban,Sombrero,Visor
Jewelry|style|1|Ring,Necklace,Bracelet,Earring,Brooch,Pendant,Anklet,Cufflink
Fabrics|style|2|Cotton,Linen,Silk,Wool,Denim,Velvet,Satin,Corduroy
Clothing patterns|style|2|Stripe,Plaid,Polka dot,Herringbone,Houndstooth,Gingham,Argyle,Paisley
Clothing fasteners|style|2|Button,Zipper,Buckle,Velcro,Snap,Hook,Lace,Toggle
Shades of blue|style|2|Navy,Azure,Cobalt,Indigo,Cerulean,Teal,Turquoise,Sky blue
Shades of red|style|2|Scarlet,Crimson,Ruby,Maroon,Burgundy,Vermilion,Carmine,Cherry
Shades of green|style|2|Emerald,Olive,Sage,Mint,Jade,Lime,Moss,Chartreuse
Makeup|style|1|Mascara,Lipstick,Foundation,Blush,Eyeliner,Concealer,Bronzer,Eyeshadow
Hairstyles|style|1|Bob,Braid,Bun,Ponytail,Mohawk,Pixie,Afro,Undercut
Ball sports|sport|1|Soccer,Basketball,Volleyball,Baseball,Tennis,Cricket,Rugby,Handball
Winter sports|sport|1|Skiing,Snowboarding,Curling,Bobsled,Ice hockey,Figure skating,Luge,Biathlon
Track events|sport|2|Sprint,Hurdles,Relay,Marathon,Long jump,High jump,Pole vault,Steeplechase
Water sports|sport|1|Swimming,Surfing,Rowing,Kayaking,Diving,Sailing,Water polo,Windsurfing
Racket sports|sport|2|Tennis,Badminton,Squash,Table tennis,Pickleball,Padel,Racquetball,Real tennis
Gym equipment|sport|1|Dumbbell,Barbell,Treadmill,Elliptical,Kettlebell,Resistance band,Bench press,Rowing machine
Basketball terms|sport|2|Dribble,Dunk,Rebound,Assist,Free throw,Three-pointer,Layup,Jump ball
Soccer terms|sport|2|Penalty,Corner,Offside,Goalkeeper,Striker,Free kick,Header,Throw-in
Golf|sport|2|Birdie,Eagle,Bogey,Par,Fairway,Putter,Tee,Bunker
Baseball positions|sport|2|Pitcher,Catcher,Shortstop,First base,Second base,Third base,Left field,Center field
Tennis scoring|sport|2|Love,Deuce,Advantage,Set,Match,Tiebreak,Ace,Break point
Swimming strokes|sport|1|Freestyle,Backstroke,Breaststroke,Butterfly
Martial arts|sport|2|Karate,Judo,Taekwondo,Aikido,Kung fu,Kendo,Jujitsu,Capoeira
Yoga poses|sport|2|Mountain,Tree,Cobra,Warrior,Triangle,Child pose,Bridge,Downward dog
Cycling gear|sport|1|Helmet,Pedal,Chain,Saddle,Handlebar,Spoke,Derailleur,Pump
Olympic field events|sport|2|Discus,Javelin,Shot put,Hammer throw,Long jump,Triple jump,High jump,Pole vault
String instruments|music|1|Violin,Cello,Guitar,Harp,Viola,Banjo,Mandolin,Ukulele,Bass
Woodwind instruments|music|2|Flute,Clarinet,Oboe,Bassoon,Piccolo,Saxophone,Recorder,Cor anglais
Brass instruments|music|2|Trumpet,Trombone,Tuba,French horn,Cornet,Flugelhorn,Euphonium,Sousaphone
Percussion instruments|music|1|Drum,Cymbal,Tambourine,Maraca,Bongo,Gong,Triangle,Xylophone
Music genres|music|1|Jazz,Blues,Rock,Pop,Country,Folk,Reggae,Classical
Tempo markings|music|2|Allegro,Adagio,Andante,Presto,Largo,Moderato,Vivace,Lento
Voice|music|2|Soprano,Alto,Tenor,Bass,Mezzo,Baritone,Contralto,Countertenor
Music notation|music|2|Clef,Staff,Rest,Note,Sharp,Flat,Barline,Time signature
Classical composers|music|2|Bach,Mozart,Beethoven,Chopin,Vivaldi,Debussy,Handel,Schubert
Song sections|music|1|Verse,Chorus,Bridge,Intro,Outro,Refrain,Pre-chorus,Interlude
Guitar|music|2|Fret,Neck,String,Pickup,Bridge,Headstock,Pickguard,Tuning peg
Ways to listen|music|1|Headphones,Earbuds,Speaker,Radio,Turntable,Boombox,Record player,Gramophone
Dance styles|arts|1|Ballet,Tap,Salsa,Tango,Waltz,Hip-hop,Flamenco,Swing
Art supplies|arts|1|Brush,Canvas,Easel,Palette,Paint,Charcoal,Pastel,Sketchbook
Painting styles|arts|2|Impressionism,Cubism,Surrealism,Realism,Expressionism,Pointillism,Pop art,Abstract
Art media|arts|2|Watercolor,Oil paint,Acrylic,Ink,Gouache,Tempera,Fresco,Encaustic
Theater|arts|1|Stage,Curtain,Spotlight,Backstage,Orchestra pit,Prop,Costume,Auditorium
Film genres|arts|1|Comedy,Drama,Horror,Thriller,Western,Musical,Documentary,Animation
Film crew roles|arts|2|Director,Producer,Editor,Gaffer,Cinematographer,Screenwriter,Grip,Sound designer
Photography|arts|2|Aperture,Shutter,Exposure,Focus,Lens,ISO,Bokeh,Tripod
Pottery|arts|2|Clay,Kiln,Glaze,Wheel,Slip,Coil,Bisque,Stoneware
Crafts|arts|1|Knitting,Weaving,Origami,Embroidery,Quilting,Crochet,Macrame,Decoupage
Famous painters|arts|2|Monet,Picasso,Rembrandt,Kahlo,Van Gogh,Matisse,O'Keeffe,Dali
Origami shapes|arts|1|Crane,Boat,Butterfly,Flower,Frog,Box,Star,Heart
Ways to travel|travel|1|Car,Bus,Train,Plane,Bicycle,Ferry,Tram,Motorcycle
Airport|travel|1|Gate,Boarding pass,Runway,Terminal,Check-in,Baggage claim,Security,Lounge
Camping gear|travel|1|Tent,Sleeping bag,Backpack,Compass,Camp stove,Flashlight,Hammock,Canteen
Hotel|travel|1|Reception,Concierge,Room key,Minibar,Room service,Elevator,Lobby,Suite
Travel documents|travel|2|Passport,Visa,Ticket,Boarding pass,Itinerary,Travel insurance,ID card,Reservation
Boats|travel|1|Canoe,Kayak,Yacht,Sailboat,Ferry,Gondola,Dinghy,Catamaran
Ship|travel|2|Bow,Stern,Port,Starboard,Mast,Deck,Keel,Hull
European capitals|travel|2|Paris,Rome,Madrid,Berlin,Vienna,Prague,Lisbon,Athens
Asian capitals|travel|2|Tokyo,Seoul,Bangkok,Hanoi,Beijing,Jakarta,Manila,Kathmandu
African capitals|travel|2|Cairo,Nairobi,Accra,Dakar,Kigali,Algiers,Rabat,Addis Ababa
World landmarks|travel|1|Eiffel Tower,Great Wall,Taj Mahal,Colosseum,Big Ben,Machu Picchu,Petra,Pyramids
Famous bridges|travel|2|Golden Gate,Tower Bridge,Brooklyn Bridge,Rialto,Ponte Vecchio,Sydney Harbour,Akashi Kaikyo,Forth Bridge
US national parks|travel|2|Yosemite,Yellowstone,Zion,Acadia,Denali,Everglades,Grand Canyon,Arches
Mountain ranges|travel|2|Alps,Andes,Himalayas,Rockies,Pyrenees,Atlas,Urals,Appalachians
Rivers|travel|2|Nile,Amazon,Danube,Ganges,Mekong,Thames,Seine,Yangtze
Islands|travel|2|Iceland,Greenland,Madagascar,Borneo,Sicily,Tasmania,Sumatra,Java
Railway|travel|1|Platform,Track,Locomotive,Carriage,Conductor,Signal,Timetable,Station
Car|travel|1|Engine,Wheel,Bumper,Windshield,Headlight,Steering wheel,Brake,Seat belt
Bicycles|travel|2|Mountain bike,Road bike,Tandem,BMX,Recumbent,Unicycle,Cruiser,Folding bike
Road signs|travel|1|Stop,Yield,Detour,One way,No entry,Speed limit,Crosswalk,Roundabout
Computer hardware|tech|1|Keyboard,Mouse,Monitor,Processor,Memory,Motherboard,Hard drive,Webcam
Internet|tech|1|Browser,Website,Link,Download,Upload,Server,Domain,Router
Programming languages|tech|2|Python,Java,Rust,Ruby,JavaScript,Swift,Kotlin,Go
File extensions|tech|2|PNG,JPEG,PDF,MP3,ZIP,HTML,CSV,TXT
Keyboard shortcuts|tech|1|Copy,Paste,Cut,Undo,Redo,Save,Find,Select all
Digital storage units|tech|2|Bit,Byte,Kilobyte,Megabyte,Gigabyte,Terabyte,Petabyte,Exabyte
Coding concepts|tech|2|Variable,Function,Loop,Array,Object,Boolean,Class,Exception
Network hardware|tech|2|Router,Modem,Switch,Hub,Access point,Repeater,Bridge,Firewall
Software|tech|1|Spreadsheet,Word processor,Browser,Database,Photo editor,Media player,Antivirus,Calendar
Web languages & formats|tech|2|HTML,CSS,JavaScript,SVG,JSON,XML,WebAssembly,Markdown
Computer keys|tech|1|Shift,Enter,Escape,Control,Tab,Alt,Delete,Space
Video game genres|tech|1|Platformer,Puzzle,Racing,Simulation,Strategy,Adventure,Role-playing,Fighting
Board games|games|1|Chess,Checkers,Monopoly,Scrabble,Clue,Backgammon,Go,Reversi
Chess pieces|games|1|King,Queen,Rook,Bishop,Knight,Pawn
Playing card ranks|games|1|Ace,King,Queen,Jack,Ten,Nine,Eight,Seven
Card suits|games|1|Hearts,Diamonds,Clubs,Spades
Dice games|games|2|Yahtzee,Farkle,Bunco,Liar's dice,Pig,Backgammon,Tenzi,Perudo
Card games|games|2|Poker,Bridge,Solitaire,Hearts,Rummy,Canasta,Euchre,Cribbage
Tabletop game pieces|games|1|Pawn,Token,Die,Card,Tile,Miniature,Meeple,Counter
Playground games|games|1|Tag,Hopscotch,Hide-and-seek,Dodgeball,Four square,Red rover,Jump rope,Capture the flag
Classic toys|games|1|Kite,Yo-yo,Top,Marble,Teddy bear,Jack-in-the-box,Rocking horse,Building block
Logic puzzles|games|2|Sudoku,Nonogram,Kakuro,KenKen,Hashi,Slitherlink,Futoshiki,Minesweeper
Puzzle|games|1|Crossword,Jigsaw,Word search,Maze,Cryptogram,Rebus,Riddle,Anagram
Video game actions|games|1|Jump,Run,Crouch,Dash,Attack,Block,Reload,Interact
Book genres|language|1|Mystery,Fantasy,Biography,Romance,Poetry,Memoir,Science fiction,Historical fiction
Book|language|1|Cover,Spine,Page,Chapter,Index,Glossary,Preface,Appendix
Punctuation marks|language|1|Comma,Period,Colon,Semicolon,Apostrophe,Hyphen,Dash,Parenthesis
Parts of speech|language|2|Noun,Verb,Adjective,Adverb,Pronoun,Preposition,Conjunction,Interjection
Literary devices|language|2|Metaphor,Simile,Alliteration,Hyperbole,Irony,Personification,Onomatopoeia,Oxymoron
Fairy tale figures|language|1|Princess,Wizard,Dragon,Giant,Fairy,Witch,Knight,King
Mythical creatures|language|2|Unicorn,Griffin,Phoenix,Mermaid,Centaur,Minotaur,Kraken,Pegasus
Greek gods|language|2|Zeus,Hera,Athena,Apollo,Artemis,Hermes,Poseidon,Demeter
Norse gods|language|2|Odin,Thor,Loki,Freya,Tyr,Baldr,Heimdall,Frigg
Shakespeare plays|language|2|Hamlet,Macbeth,Othello,King Lear,The Tempest,Twelfth Night,Julius Caesar,As You Like It
Story ingredients|language|1|Character,Plot,Setting,Conflict,Theme,Dialogue,Climax,Resolution
Writing tools|language|1|Pen,Pencil,Quill,Typewriter,Notebook,Ink,Stylus,Eraser
Feelings|life|1|Joy,Anger,Fear,Surprise,Sadness,Hope,Envy,Pride
Occupations|life|1|Teacher,Doctor,Farmer,Chef,Pilot,Engineer,Artist,Nurse
School|life|1|Desk,Chalkboard,Textbook,Backpack,Recess,Classroom,Homework,Library
Office supplies|life|1|Stapler,Paperclip,Folder,Envelope,Notepad,Highlighter,Sticky note,Binder
Days of the week|life|1|Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
Months|life|1|January,February,March,April,May,June,July,August,September,October,November,December
Seasons|life|1|Spring,Summer,Autumn,Winter
Wedding|life|1|Bouquet,Veil,Ring,Vow,Cake,Confetti,Invitation,Aisle
Birthday party|life|1|Balloon,Candle,Cake,Present,Party hat,Streamers,Invitation,Pinata
Ways to say hello|life|1|Hi,Howdy,Bonjour,Hola,Ciao,Aloha,Hej,Salam
Relaxing activities|life|1|Reading,Meditation,Stargazing,Journaling,Gardening,Napping,Walking,Coloring
Post office|life|1|Stamp,Parcel,Envelope,Postcard,Mailbox,Postmark,Address,Letter
Emergency services|life|1|Firefighter,Paramedic,Police officer,Dispatcher,Ambulance,Fire engine,Rescue boat,Search team
Units of time|life|1|Second,Minute,Hour,Day,Week,Month,Year,Decade
Family relations|life|1|Mother,Father,Sister,Brother,Aunt,Uncle,Cousin,Grandparent
Ways to pay|life|1|Cash,Credit card,Debit card,Check,Bank transfer,Gift card,Money order,Mobile wallet
School subjects|life|1|Math,History,Geography,Science,Art,Music,Literature,Languages
Library|life|1|Catalog,Librarian,Checkout,Due date,Bookmark,Bookshelf,Reference,Reading room
Shapes|math|1|Circle,Square,Triangle,Rectangle,Oval,Hexagon,Pentagon,Octagon
Solids|math|2|Cube,Sphere,Cone,Cylinder,Pyramid,Torus,Prism,Octahedron
Arithmetic operations|math|1|Add,Subtract,Multiply,Divide
Geometry|math|2|Angle,Vertex,Edge,Face,Radius,Diameter,Perimeter,Area
Numbers|math|2|Integer,Fraction,Decimal,Prime,Rational,Irrational,Complex,Natural
Math symbols|math|1|Plus,Minus,Equals,Percent,Infinity,Pi,Square root,Division
Quadrilaterals|math|2|Square,Rectangle,Rhombus,Trapezoid,Kite,Parallelogram
Statistical terms|math|2|Mean,Median,Mode,Range,Variance,Deviation,Quartile,Percentile
Starts with silent K|wordplay|3|Knee,Knife,Knock,Knot,Know,Knuckle,Knead,Knit
Palindromes|wordplay|3|Level,Radar,Civic,Kayak,Refer,Rotator,Deified,Racecar
Sounds like a letter|wordplay|3|Bee,Sea,Eye,Tea,Pea,Queue,Why,You
Words after rain|wordplay|3|Bow,Coat,Drop,Fall,Forest,Check,Storm,Water
Words before house|wordplay|3|Light,Green,Tree,Farm,Ware,Dog,Club,Boat
Words before cake|wordplay|3|Cup,Pan,Cheese,Short,Carrot,Crab,Angel,Wedding
Words before ball|wordplay|3|Snow,Foot,Basket,Base,Volley,Cannon,Meat,Eyeball
Words after book|wordplay|3|Mark,Case,End,Worm,Shop,Club,Binding,Shelf
Words before fly|wordplay|3|Butter,Dragon,Fire,House,Horse,May,Sand,Black
Words after sun|wordplay|3|Rise,Set,Shine,Burn,Flower,Screen,Beam,Dial
Things with keys|wordplay|3|Piano,Keyboard,Lock,Map,Hotel room,Car,Dictionary,Cipher
Things with rings|wordplay|3|Saturn,Tree,Phone,Boxing arena,Wedding,Circus,Onion,Target
Things with teeth|wordplay|3|Comb,Saw,Gear,Zipper,Fork,Shark,Rake,Cog
Things with heads|wordplay|3|Coin,Nail,Cabbage,Drum,Match,Pin,Garlic,Lettuce
Things with wings|wordplay|3|Bird,Airplane,Butterfly,Hospital,Theater,Angel,Bat,Dragon
Things with eyes|wordplay|3|Needle,Potato,Storm,Peacock,Die,Hook,Coconut,Person
Things that can be drawn|wordplay|3|Picture,Bath,Curtain,Card,Conclusion,Breath,Attention,Weapon
Things that can be broken|wordplay|3|Promise,Record,Silence,Ice,Heart,Rule,Glass,Habit
Things that can be caught|wordplay|3|Fish,Cold,Bus,Ball,Criminal,Attention,Wave,Drift
Words before board|wordplay|3|Surf,Skate,Key,Dash,Card,Black,White,Spring
Words before light|wordplay|3|Moon,Star,Flash,Spot,Day,Head,Sun,Gas
Words before work|wordplay|3|Home,Team,Frame,Clock,Net,Paper,Fire,Needle
Words before paper|wordplay|3|News,Wall,Sand,Wax,Toilet,Graph,Tissue,Wrapping
Words before line|wordplay|3|Head,Dead,Coast,Border,Out,Life,Base,Time
Rhymes with night|wordplay|2|Light,Sight,Flight,Right,Bright,Height,White,Kite
Rhymes with blue|wordplay|2|True,Clue,Glue,Shoe,New,Dew,Through,View
Rhymes with lake|wordplay|2|Cake,Bake,Shake,Snake,Wake,Brake,Flake,Stake
Rhymes with rose|wordplay|2|Nose,Pose,Hose,Toes,Close,Those,Flows,Prose
Ends in -ology|wordplay|2|Biology,Geology,Ecology,Zoology,Mythology,Anthropology,Archaeology,Entomology
Starts with tri-|wordplay|2|Triangle,Tricycle,Trilogy,Tripod,Trident,Tricolor,Triceps,Trio
Double letters|wordplay|2|Balloon,Coffee,Broccoli,Committee,Bookkeeper,Toffee,Bassoon,Apple
Silent W|wordplay|3|Write,Wrong,Wrist,Wrap,Wreck,Wrestle,Wrench,Wreath
Bass|music|2|Electric,Upright,Fretless,Acoustic,Five-string,Six-string,Short-scale,Piccolo bass
Keys|tech|1|Enter,Shift,Escape,Tab,Control,Alt,Delete,Space
Rock|nature|2|Granite,Basalt,Marble,Slate,Limestone,Sandstone,Obsidian,Pumice
Pitch|sport|2|Fastball,Curveball,Slider,Sinker,Cutter,Changeup,Splitter,Knuckleball
Jam|food|1|Strawberry,Raspberry,Apricot,Blackberry,Blueberry,Peach,Plum,Fig
Bows|sport|2|Recurve,Longbow,Compound,Crossbow
Cricket|sport|2|Wicket,Innings,Bowler,Crease,Stump,Boundary,Over,Leg spin
At the bank|life|1|Bank,Loan,Deposit,Interest,Account,Teller,Mortgage,Withdrawal
River features|nature|2|Bank,Bed,Channel,Source,Mouth,Meander,Rapids,Delta
Small mammals|animals|1|Mouse,Rat,Vole,Shrew,Gerbil,Hamster,Dormouse,Chipmunk
Sports gear|sport|1|Bat,Ball,Net,Racket,Stick,Glove,Helmet,Pad
Warm colors|arts|1|Orange,Red,Yellow,Scarlet,Coral,Amber,Gold,Vermilion
Musical qualities|music|2|Pitch,Tone,Rhythm,Timbre,Melody,Harmony,Tempo,Dynamics
Garden bugs|animals|1|Cricket,Grasshopper,Ant,Beetle,Ladybug,Aphid,Lacewing,Caterpillar
Music session|music|2|Jam,Solo,Improvisation,Groove,Riff,Chorus,Bridge,Break
Outdoor places|travel|1|Garden,Beach,Park,Forest,Playground,Meadow,Orchard,Campground
Buildings|home|1|School,Library,Hospital,Airport,Bakery,Hotel,Museum,Theater
Vehicles|travel|1|Car,Ship,Train,Bus,Truck,Motorcycle,Canoe,Tractor
Reading material|language|1|Book,Magazine,Newspaper,Journal,Comic,Atlas,Dictionary,Novel
Instrument families|music|2|String instruments,Woodwind instruments,Brass instruments,Percussion instruments,Keyboard instruments,Electronic instruments,Plucked instruments,Bowed instruments
Hot drinks|food|1|Coffee,Tea,Cocoa,Cider,Hot chocolate,Chai,Espresso,Herbal tea
Map features|travel|2|Buildings,Roads,Rivers,Borders,Parks,Landmarks,Paths,Lakes
Musical topics|music|2|Music genres,Instrument families,Musical qualities,Music session,Notation,Composition,Performance,Recording
`;

export function themeName(name){
  const shorter=name.replace(/^(?:Types|Kinds) of\s+/i,'').replace(/\s+Types$/i,'');
  return shorter===name?name:shorter.charAt(0).toUpperCase()+shorter.slice(1);
}

const catalogue = rows.trim().split('\n').map((row, i) => {
  const [name, domain, difficulty, pool] = row.split('|');
  return {id:`theme-${String(i + 1).padStart(3,'0')}`,name:themeName(name),domain,difficulty:Number(difficulty),words:pool.split(',')};
});
// An expansion row with an existing name deliberately deepens that pool. Keep
// original IDs stable, and allow shared clues across different themes.
for(const [pack,popCulture] of[[everydayRows,false],[popCultureRows,true]])for(const row of pack.trim().split('\n')){
  const [name,domain,difficulty,pool]=row.split('|'),words=pool.split(','),existing=catalogue.find(t=>t.name.toLowerCase()===name.toLowerCase());
  if(existing){
    const used=new Set(existing.words.map(w=>w.toLowerCase()));for(const word of words)if(!used.has(word.toLowerCase())){existing.words.push(word);used.add(word.toLowerCase());}
  }else catalogue.push({id:`theme-${String(catalogue.length+1).padStart(3,'0')}`,name,domain,difficulty:Number(difficulty),words,...(popCulture?{popCulture:true}:{})});
}
export const THEMES=Object.freeze(catalogue.map(theme=>Object.freeze({...theme,words:Object.freeze(theme.words)})));

export const PICTURES = Object.freeze({
  Apple:'🍎',Pear:'🍐',Peach:'🍑',Orange:'🍊',Banana:'🍌',Grape:'🍇',Mango:'🥭',Strawberry:'🍓',
  Blueberry:'🫐',Carrot:'🥕',Broccoli:'🥦',Corn:'🌽',Lemon:'🍋',Watermelon:'🍉',
  Dog:'🐕',Cat:'🐈',Rabbit:'🐇',Goldfish:'🐠',Cow:'🐄',Pig:'🐖',Sheep:'🐑',Horse:'🐎',
  Chicken:'🐔',Duck:'🦆',Lion:'🦁',Tiger:'🐅',Fox:'🦊',Deer:'🦌',Owl:'🦉',Bee:'🐝',
  Butterfly:'🦋',Ant:'🐜',Turtle:'🐢',Snake:'🐍',Whale:'🐋',Dolphin:'🐬',Octopus:'🐙',Shark:'🦈',
  Rose:'🌹',Tulip:'🌷',Daisy:'🌼',Sunshine:'☀️',Rain:'🌧️',Snow:'❄️',Thunder:'⛈️',
  Car:'🚗',Bus:'🚌',Train:'🚆',Plane:'✈️',Bicycle:'🚲',Motorcycle:'🏍️',Rocket:'🚀',
  Guitar:'🎸',Violin:'🎻',Drum:'🥁',Trumpet:'🎺',Saxophone:'🎷',Banjo:'🪕',
  Shirt:'👕',Dress:'👗',Coat:'🧥',Sneaker:'👟',Boot:'🥾',Ring:'💍',Crown:'👑',
  Hammer:'🔨',Wrench:'🔧',Screwdriver:'🪛',Saw:'🪚',Pen:'🖊️',Pencil:'✏️',
  Tent:'⛺',Compass:'🧭',Flashlight:'🔦',Backpack:'🎒',Kite:'🪁',Balloon:'🎈',Candle:'🕯️',Cake:'🎂'
});

export const SPECIALS = Object.freeze([
  {id:'picture',icon:'🍎',name:'Picture',description:'An image stands in for a word. Match its meaning.',tip:'A picture of an apple still belongs in the fruit bowl.',level:2},
  {id:'frozen',icon:'❄️',name:'Frozen',description:'Four successful merges thaw the ice. Partial and split-word joins count too.',tip:'Cracks deepen and ice fragments fall away with each successful join.',level:3},
  {id:'split',icon:'◒',name:'Split word',description:'Join the two fragments before sorting the whole word.',tip:'Drag matching fragments together in either order.',level:4},
  {id:'cryptic',icon:'∴',name:'Dots',description:'Dots conceal letters that emerge as you make connections.',tip:'Every successful merge reveals a letter. Connecting this word reveals it completely.',level:5},
  {id:'keylock',icon:'🔐',name:'Lock & key',description:'Merge a key bubble to reveal the word in the lock of the same color.',tip:'Several colors can appear together. Locks arrive before their keys; a successful partial merge unlocks immediately.',level:6},
  {id:'screw',icon:'⊕',name:'Screw',description:'Drag a screwdriver onto any other bubble to remove a screw of the same color.',tip:'Themes do not need to match. Each tool removes one matching screw and is used up. Unrelated words stay separate; matching words also join as usual. The ring arrives before its tools.',level:7},
  {id:'backward',icon:'↶',name:'Backward',description:'Read the letters from right to left.',tip:'The word is reversed; its meaning has not changed.',level:8},
  {id:'linked',icon:'⛓',name:'Linked',description:'Two words travel together, but one is a secret decoy.',tip:'Match the real word with its theme to pop its partner and break the link.',level:9},
  {id:'burst',icon:'✹',name:'Burst',description:'Finish this group before its move countdown reaches zero.',tip:'Actions spend the countdown; thinking never does. Popping its group disarms it.',level:10},
  {id:'nested',icon:'◎',name:'Theme bubble',description:'Some solved themes return as ordinary words, forming chains of connections.',tip:'Flowers can become Garden, then Outdoor places. A returning word can also take on a different meaning.',level:11},
  {id:'sealed',icon:'🌿',name:'Tangled',description:'Kelp holds this bubble until another group is completed.',tip:'Pop any group to loosen the kelp and set the word free.',level:12},
  {id:'pinlock',icon:'📌',name:'Pinned',description:'Clear the groups with green pins to release the held word.',tip:'Each completed pin group pulls one pin out of the bubble.',level:13},
  {id:'bonus',icon:'+5',name:'Bonus moves',description:'Tap this bubble for five extra moves in games with a move budget.',tip:'This demo uses a move budget without changing your settings.',level:14}
]);
export const INTRO_LEVELS = SPECIALS.length + 1;

export const LIBRARY_STATS = Object.freeze({
  themes: THEMES.length,
  entries: THEMES.reduce((sum, theme) => sum + theme.words.length, 0),
  words: new Set(THEMES.flatMap(theme => theme.words.map(word => word.toLowerCase()))).size,
  domains: new Set(THEMES.map(theme => theme.domain)).size,
  popCulture:THEMES.filter(theme=>theme.popCulture).length
});
