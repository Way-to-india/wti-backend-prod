/**
 * US-871 — A SOLD CIRCUIT'S DAYS SPEAK ITS OWN ITINERARY (founder's Nau Devi test).
 * "Chandigarh — full day", twice, to a pilgrim — while tour_itinerary knew the day is
 * Mansa Devi at Panchkula and the three shrines en route to Dharamshala. These tests
 * pin the overlay: tour text lands on the right days, transport truth is kept, spelling
 * drift (Dharamshala/Dharamsala) is bridged, and a plan that is NOT the tour is left
 * untouched.
 */
import { describe, test, expect } from 'bun:test';
import { overlayTourDays, type TourDayText } from '../namedCircuits';

// The real Nau Devi rows, abridged from tour_itinerary.
const ITIN: TourDayText[] = [
  { day: 1, title: 'Arrival at Haridwar – Rishikesh Sightseeing', description: 'Join the road trip from Delhi to Haridwar and check in. Explore Ram Jhula and Lakshman Jhula and join the evening Ganga aarti.' },
  { day: 2, title: 'Haridwar Sightseeing – Chandigarh', description: 'Take a holy dip in Ganga at Har-ki-Pauri. Ropeway to the Mansa Devi Temple. Proceed to Chandigarh.' },
  { day: 3, title: 'Chandigarh – Dharamshala', description: 'Visit the second shrine, the Temple of Mansa Devi at Panchkula. On the way, visit 3 shrines at Naina Devi, Baglamukhi Devi and Chintpurni Mata. Check in at Dharamshala.' },
  { day: 4, title: 'Dharamshala Sightseeing', description: 'Visit 3 more shrines – Chamunda Devi, Jwalaji and Kangra Devi. Also visit the Tibetan Monastery.' },
  { day: 5, title: 'Dharamshala - Katra', description: 'Join the road trip to Katra in Jammu & Kashmir. Check in at the hotel on arrival.' },
  { day: 6, title: 'Vaishno Devi Temple', description: 'Visit the last shrine of the tour, the Vaishno Devi Temple. Get back to the hotel by night.' },
  { day: 7, title: 'Katra Departure', description: 'Transfer to the airport or railway station, or drive back to Delhi.' },
];

const planDays = () => [
  { city: 'Haridwar', activity: 'Drive Delhi → Haridwar', transit: { mode: 'ROAD' } },
  { city: 'Chandigarh', activity: 'Drive Haridwar → Chandigarh', transit: { mode: 'ROAD' } },
  { city: 'Dharamsala', activity: 'Drive Chandigarh → Dharamsala', transit: { mode: 'ROAD' } },
  { city: 'Dharamsala', activity: 'Dharamsala — full day', transit: null },
  { city: 'Katra', activity: 'Drive Dharamsala → Katra', transit: { mode: 'ROAD' } },
  { city: 'Katra', activity: 'Katra — full day', transit: null },
];

describe('US-871 — the days finally say what the day is FOR', () => {
  test('every day of the Nau Devi pick carries its tour text, in order', () => {
    const days = planDays();
    expect(overlayTourDays(days, ITIN)).toBe(6);
    expect(days[1].activity).toContain('Har-ki-Pauri');                 // the dip, on the Chandigarh day
    expect(days[2].activity).toContain('Naina Devi');                    // the en-route shrines
    expect(days[3].activity).toContain('Chamunda Devi');                 // the Dharamshala base day
    expect(days[3].activity).not.toContain('full day');                  // the generic label is GONE
    expect(days[5].activity).toContain('Vaishno Devi');
  });

  test('a transit day KEEPS the engine transport truth and gains the purpose', () => {
    const days = planDays();
    overlayTourDays(days, ITIN);
    expect(days[2].activity).toMatch(/^Drive Chandigarh → Dharamsala — /);
  });

  test('Dharamshala and Dharamsala are the same town — spelling drift is bridged', () => {
    const days = [
      { city: 'Dharamsala', activity: 'Dharamsala — full day', transit: null },
      { city: 'Katra', activity: 'Katra — full day', transit: null },
    ];
    expect(overlayTourDays(days, ITIN)).toBe(2);
    // the first tour day that names Dharamshala (spelled with the h) claimed the day
    // spelled without it — the drift is bridged in both directions.
    expect(days[0].activity).toContain('Naina Devi');
  });

  test('a plan that is NOT this tour is left byte-for-byte alone', () => {
    const days = [
      { city: 'Munnar', activity: 'Munnar — full day', transit: null },
      { city: 'Cochin', activity: 'Drive Munnar → Cochin', transit: { mode: 'ROAD' } },
    ];
    const before = JSON.stringify(days);
    expect(overlayTourDays(days, ITIN)).toBe(0);
    expect(JSON.stringify(days)).toBe(before);
  });
});
