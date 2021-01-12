import { createSelector } from "reselect";
import buildUrl from "build-url";

import { State } from "..";

import * as prototypes from '../prototypes';
import * as sites from '../sites';
import * as locales from '../locales';

export const searchTerm = (state: State) =>
    state.navigation.searchTerm
;

export const currentIndex = (state: State) =>
    state.navigation.currentIndex
;

export const isOpen = (state: State) =>
    state.navigation.isOpen
;

interface IndexedData {
    name: string
    title: string
    description: string
    structure: {
        label: string
        position: number
    }
    options?: {
        position: number
    }
}

interface SearchResult {
    indexedData: IndexedData
    relevance: number
}

interface Groups {
    [key: string]: {
        label: string
        prototypes: {
            name: string
            isFocused: boolean
        }[]
    }
}

function getRelevanceForIndexedDataAndSearchTerm(
    indexedData: IndexedData,
    searchTerm: string
) {
    const hasMatchingTitle = indexedData.title.toLowerCase()
        .includes(searchTerm);
    const hasMatchingName = indexedData.name.toLowerCase()
        .includes(searchTerm);
    const hasMatchingDescription = indexedData.description.toLowerCase()
        .includes(searchTerm);
    const relevance =
        2 * Number(hasMatchingTitle)
        + Number(hasMatchingName)
        + Number(hasMatchingDescription);

    return relevance;
}

function getSortingPriorityForSearchResults(
    searchResultA: SearchResult,
    searchResultB: SearchResult
): number {
    const { indexedData: indexedDataA } = searchResultA;
    const { indexedData: indexedDataB } = searchResultB;

    if (indexedDataA.structure.position !== indexedDataB.structure.position) {
        return indexedDataB.structure.position - indexedDataA.structure.position;
    }

    if (indexedDataA.options && indexedDataB.options) {
        if (indexedDataA.options.position !== indexedDataB.options.position) {
            return indexedDataB.options.position - indexedDataA.options.position;
        }
    }


    if (indexedDataA.title !== indexedDataB.title) {
        if (indexedDataA.title > indexedDataB.title) {
            return -1;
        } else {
            return 1;
        }
    }

    return searchResultB.relevance - searchResultA.relevance;
}

export const filteredAndGroupedPrototypes = createSelector(
    [
        prototypes.selectors.all,
        searchTerm,
        currentIndex
    ],
    (prototypes, searchTerm, currentIndex) => {
        const lowerCasedSearchTerm = searchTerm.toLowerCase();
        const result = Object.values(
            Object.entries(prototypes)
                .map(([name, prototype]) => {
                    const indexedData: IndexedData = { ...prototype, name };
                    const relevance = getRelevanceForIndexedDataAndSearchTerm(
                        indexedData,
                        lowerCasedSearchTerm
                    );

                    return { indexedData, relevance };
                })
                .filter(searchResult => searchResult.relevance)
                .sort(getSortingPriorityForSearchResults)
                .map((searchResult, index) => ({...searchResult, isFocused: currentIndex === index}))
                .reduce((groups, searchResult) => {
                    const { structure } = searchResult.indexedData;

                    if (!groups[structure.label]) {
                        groups[structure.label] = {
                            ...structure,
                            prototypes: []
                        };
                    }

                    groups[structure.label].prototypes.push({
                        ...searchResult.indexedData,
                        isFocused: searchResult.isFocused
                    });

                    return groups;
                }, {} as Groups)
        );

        return result;
    }
);

export const previewUri = createSelector(
    [
        (state: State) => state.env.previewUri,
        prototypes.selectors.currentlyRendered,
        prototypes.selectors.overriddenProps,
        prototypes.selectors.selectedPropSet,
        locales.selectors.current,
        sites.selectors.currentlySelectedSitePackageKey
    ],
    (endpoint, renderedPrototype, props, propSet, locales, sitePackageKey) => {
        if (!renderedPrototype) {
            return null;
        }

        const {prototypeName} = renderedPrototype;

        return buildUrl(`${window.location.protocol}//${window.location.host}${endpoint}`, {
            queryParams: {
                prototypeName,
                propSet,
                sitePackageKey,
                locales,
                props: JSON.stringify(props)
            }
        });
    }
);
