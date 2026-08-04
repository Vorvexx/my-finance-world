# Vorvex Permanent Architecture

## Purpose

This document defines the durable conceptual architecture of Vorvex. It describes how the parts of a person's life relate to one another independently of interfaces, storage systems, programming languages, or other implementation choices.

The architecture follows one direction:

```text
Person
  ↓
Worlds
  ↓
Objects
  ↓
Events
  ↓
Money
```

The order matters. Vorvex begins with the Person and their life. Money appears at the end because it records and connects what happens in that life; it does not define the life itself.

## Person

The Person is the root of the system.

A Person owns Worlds. Everything represented by Vorvex ultimately exists in relation to a Person: what they own, manage, care about, have experienced, or are planning.

The Person is not an account holder attached to financial records. Financial records are one part of the Person's broader story. This distinction prevents institutions, accounts, and transactions from becoming the organizing structure of the product.

## Worlds

A World represents an important, durable part of a Person's life.

Worlds may represent a home, car, investment, pet, phone, business, career, collection, trip, aspect of health, or another subject that matters over time. A World provides a coherent boundary around the Objects, Events, financial activity, documents, relationships, and history associated with that subject.

A World has its own identity and lifecycle. It may be planned, active, completed, sold, closed, or archived. Its history remains part of the Person's life when its active period ends.

Worlds may relate to other Worlds. A business may own a vehicle. A career may fund an investment. A trip may involve a car, a pet, and several financial accounts. These relationships make the Person's life explorable without collapsing distinct subjects into a single category.

## Objects

Each World owns Objects.

An Object is a meaningful thing within a World. It may be physical, financial, contractual, administrative, or conceptual. Objects give structure to the World and allow its details to be understood independently.

For example, a House World may contain a mortgage, insurance policy, repair, piece of furniture, utility service, valuation, appliance, room, and document. The House is the World; these are Objects within its story.

Objects may be shared across relevant views without becoming separate records. A mortgage is an Object in the House World and is also relevant to the Person's liabilities, cash flow, and future commitments.

Objects may contain or relate to other Objects. This allows Vorvex to represent deeper levels of detail without changing the basic architecture.

## Events

Objects have Events.

An Event records something that happened, is happening, or is expected to happen to an Object. Events give an Object its history and explain its current state.

Examples include a purchase, payment, repair, valuation, renewal, contribution, withdrawal, service, claim, milestone, ownership change, or sale. An Event can record a known fact, a planned commitment, or an estimate, provided its status is clear.

Events are the source of change through time. They explain why a balance moved, why a value changed, why an obligation exists, or why attention is required. A current state without its Events is only a snapshot; Events turn it into a story.

## Money

Events generate financial activity.

An Event may create an inflow, outflow, transfer, liability, change in value, or other financial consequence. Some Events have no immediate financial activity but remain important to the Object and World.

Money connects Worlds instead of defining them.

A salary Event in a Career World may fund an investment contribution in an Investment World. A payment may reduce a mortgage Object in a House World. A veterinary Event in a Pet World may create an outflow from a cash account. The financial relationship connects these Worlds while each World retains its own meaning and history.

Money therefore provides a shared perspective across the Person's life. It can answer questions about position, movement, commitments, and change without replacing the Worlds that give those numbers meaning.

## Example Worlds

### House World

A House World tells the complete story of a home. It may include:

- Purchase and ownership
- Mortgage
- Insurance
- Repairs and maintenance
- Furniture and contents
- Current and historical value
- Utilities
- Taxes and fees
- Renovations
- Documents
- Sale and archived history

The mortgage appears as part of the House World, as a liability in the Person's financial position, and as a source of recurring financial Events. These are different views of one underlying Object.

### Car World

A Car World may include purchase, financing, insurance, fuel, service, repairs, mileage, value, documents, accessories, and sale. It preserves both the financial and practical history of the vehicle.

### Investment World

An Investment World may include accounts, holdings, contributions, distributions, fees, transfers, value changes, goals, institutions, and documents. It explains not only the current value but also how the Person arrived there.

### Pet World

A Pet World may include adoption, health records, veterinary care, insurance, food, services, medications, milestones, documents, and memories. Financial activity supports the story but does not reduce the pet to an expense category.

### Phone World

A Phone World may include the device, purchase, financing, mobile service, insurance, repairs, accessories, trade-in value, documents, and eventual replacement or sale.

### Business World

A Business World may include ownership, revenue, customers, expenses, assets, liabilities, contracts, employees, taxes, documents, milestones, and changes in value. Objects within the Business World may also connect to the Person's broader financial position and other Worlds.

## One Truth, Multiple Views

Duplication in the interface is acceptable. Duplication in the underlying data is not.

The same Object or Event should appear wherever it helps the Person understand the current context. A mortgage belongs in a House World, a liabilities view, a cash-flow view, and a list of upcoming commitments. Requiring the Person to search one technically correct location would place the system's structure ahead of their needs.

These appearances are views of one authoritative Object. They must share identity, history, status, and financial consequences. A change made through one view must be reflected in every other view.

Copying the underlying data would create competing versions of truth. Values would diverge, history would become ambiguous, and the Person could no longer trust the system. Vorvex therefore permits contextual repetition while preserving one source of truth.

## Architectural Test

Every addition to the system should be explainable through this structure:

1. Which Person does it belong to?
2. Which World gives it meaning?
3. What Object does it describe?
4. Which Events explain its state through time?
5. What financial activity, if any, connects it to the rest of the Person's life?

If something cannot be placed in this structure, its role in Vorvex is not yet clear.
