import {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from 'react';

type Group = {
    id: string;
    name: string;
};

type GroupsContextValue = {
    groups: Group[];
    createGroup: (name: string) => void;
};

const GroupsContext = createContext<GroupsContextValue | undefined>(undefined);

export function GroupsProvider({ children }: { children: ReactNode }) {
    const [groups, setGroups] = useState<Group[]>([]);

    function createGroup(name: string) {
        const group: Group = {
            id: Date.now().toString(),
            name,
        };

        setGroups((currentGroups) => [...currentGroups, group]);
    }

    return (
        <GroupsContext.Provider value={{ groups, createGroup }}>
            {children}
        </GroupsContext.Provider>
    );
}

export function useGroups() {
    const context = useContext(GroupsContext);

    if (!context) {
        throw new Error('useGroups must be used inside GroupsProvider');
    }

    return context;
}