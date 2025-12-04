import { type RouteConfig, index, route} from "@react-router/dev/routes";

export default [index("routes/index.tsx"),
    route("register", "routes/register.tsx"),
    route("lost/:eid", "routes/lost.$eid.tsx"),
    route("find/:eid", "routes/find.$eid.tsx"),
    route("my-trackers", "routes/my-trackers.tsx"),
    route("scan", "routes/scan.tsx"),
] satisfies RouteConfig;
