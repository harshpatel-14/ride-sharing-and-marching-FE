export const site = {
  name: 'Rideshare',
  description: 'Post a ride, find a match, book a seat that is actually yours.',
  nav: [
    { href: '/search', label: 'Find a ride' },
    { href: '/rides/new', label: 'Offer a ride' },
    { href: '/bookings', label: 'My bookings' },
    { href: '/rides/mine', label: 'My rides' },
  ],
} as const
