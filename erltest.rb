#!/usr/bin/env ruby
require_relative('erlang')

node = "hoge@fuga"
cookie = File.read(ENV['HOME']+"/.erlang.cookie")
erl = Erlang::Erl.new(node, cookie)

p erl.nodes
if erl.nodes.empty?
  raise "no available node."
end

if erl.rpc_call(erl.nodes[0], :io, :format, ["Hello!\n"]) != :ok
  raise " != :ok"
end

p erl.rpc_call(erl.nodes[0], :erlang, :processes, [])

p erl.rpc_call(erl.nodes[0], :maps, :from_list, [[Erlang::Tuple[:a,2],Erlang::Tuple[:b,4]]])
p erl.rpc_call(erl.nodes[0], :maps, :to_list, [{a: 123, b: 456}])

